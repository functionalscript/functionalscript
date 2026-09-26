/**
 * Node.js effect runner: interprets `Effect<NodeOp, T, E>` directly against the
 * Node globals and built-in modules (`fs`, `http`, `child_process`, `process`,
 * `fetch`, …).
 *
 * There is deliberately no injectable IO seam here. Effectful programs are
 * tested against the in-memory interpreters in `fjs/effects/mock` and
 * `fjs/effects/node/virtual`, which interpret the same operations without
 * touching the OS, so a handler-table indirection in this module would have
 * exactly one instance and no consumer — the handlers reference the Node
 * globals directly instead.
 *
 * @module
 *
 * @import { Effect } from '../types.ts'
 * @import { IoResult, Server as EffectServer, Module, NodeOp, RequestListener as Erl, NodeProgram, NodeProgramOptions, WriteConsoles, TestContext, TestFn, } from './types.ts'
 * @import { _Readable, _RequestBodyReader, _RequestListener, _Server, _ServerResponse } from './private.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { FileHandle } from 'node:fs/promises'
 */

import http from 'node:http'
import childProcess from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'
import zlib from 'node:zlib'
import { once } from 'node:events'
import * as testContext from 'node:test'

import { concat, normalize, toPosix } from '../../path/module.f.mjs'
import { decode as decodeImportPath } from '../../path/import/module.f.mjs'
import { asyncRun } from '../module.mjs'
import { memoryOperationMap } from './memory/module.mjs'
import { commonOperationMap } from '../common/module.mjs'
import {
    emptyHost, emptyHostCode, emptyHostMessage, exitCode, inflateTrailingCode, inflateTrailingMessage,
    notAFileCode, notAFileMessage, requestBody, requestBodyOffsetMessage, toIoError,
    usesInlineTestContext,
} from './module.f.mjs'
import { asBase, asNominal } from '../../types/nominal/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { asyncTryCatch, tryCatch } from '../../types/result/module.mjs'
import { fromVec, toVec } from '../../types/uint8array/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'

/**
 * Narrowed structural view of `node:http`'s `createServer`. The official types
 * declare `method`/`url` optional and header values as
 * `string | string[] | undefined`, while the effect-level `_RequestListener`
 * requires them present; this local view keeps the narrowing in one place.
 * @type {(listener: _RequestListener) => _Server}
 */
const createServer = http.createServer

/**
 * Performs host IO, reporting a thrown failure as an {@link IoResult} error.
 *
 * Every filesystem, network, and subprocess handler below goes through it, so
 * the `catch` that turns an exception into effect data — and the normalization
 * that keeps the channel serializable — happens in exactly one place.
 *
 * @template T
 * @param {() => Promise<T>} f
 * @returns {Promise<IoResult<T>>}
 */
const io = async f => {
    const r = await asyncTryCatch(f)
    return r[0] === 'ok' ? r : error(toIoError(r[1]))
}

/**
 * One request body's cursor: the chunks the client sent, handed out one pull at
 * a time and never held.
 *
 * **Nothing accumulates here, and that is the change.** This used to be
 * `collectBounded`, which read the whole body into an array before the listener
 * was called and gave up at the `Vec` cap, because `IncomingMessage.body` was
 * one `Vec` and there was no larger request value to build. A `List` body means
 * the listener pulls, so the runner's own cost per request is one chunk rather
 * than the body — and there is no cap left to refuse at.
 *
 * **The position is `let`, and a closure is where it can be.** The offset a
 * pull names is checked against it rather than sought to, because a socket has
 * one position and cannot go back — see `ReadRequestBytes` in `./types.ts` for
 * why that check is the answer to a second pull and not a convenience. The
 * variable never leaves this function, so nothing observes the mutation, which
 * is the condition under which the impure shell is allowed to be impure.
 *
 * **The check, the read and the update are one step, and the queue is what
 * makes them one.** {@link runNodeEffect} answers `all` with `Promise.all`, so
 * a listener that pulls one cell twice through `all` or `both` has both pulls
 * started before either awaits. Checked per pull, both passed, both read, and
 * both answered `ok` — one immutable cell handing out two different chunks,
 * each a piece of the body, in order and under a correct length, with
 * nothing downstream able to tell which piece it had. So a pull runs behind the
 * pull before it, and the second then meets the position the first left.
 *
 * **What the loser gets is the offset refusal, not a refusal of its own.** A
 * cell has one consumer — a `List` gives a consumer no way to tell a producer
 * it has stopped ([`../list/types.ts`](../list/types.ts)) — so the second pull
 * is refused either way, and the only question is in whose words. The virtual
 * runner folds `all` over its state, so it already answers a concurrent re-pull
 * with `requestBodyOffsetMessage`. A busy flag — "a read is in flight",
 * answered at once — would need a second message that only this runner could
 * ever produce, and no proof against the virtual runner could meet it. Queueing
 * costs nothing to wait for, either: the listener is awaiting both pulls, so
 * the refusal arrives with the chunk that caused it.
 *
 * The queue links on *settlement*, not on success, so a refused pull refuses
 * nothing after it — the refusal belongs to the pull that lost, and the winner's
 * tail is still there to be read.
 *
 * An empty chunk is skipped rather than reported, because no bytes is how this
 * operation says *end* and Node's parser has no obligation to keep the two
 * apart. A chunk larger than a `Vec` is refused by `toVec` at the call site,
 * loudly, rather than truncated — Node hands at most the socket's own
 * high-water mark, 65,536 bytes on Darwin with Node 23.11.0, which is half the
 * cap, so `size` is a bound the return type already keeps.
 *
 * @param {_Readable} v
 * @returns {_RequestBodyReader}
 */
const requestBodyReader = v => {
    const i = v[Symbol.asyncIterator]()
    let position = 0
    /** @type {Promise<unknown>} */
    let queue = Promise.resolve()
    return (offset, _size) => {
        const pull = queue.then(async () => {
            if (offset !== position) {
                throw new Error(requestBodyOffsetMessage(offset, position))
            }
            for (;;) {
                const next = await i.next()
                if (next.done === true) { return emptyBody }
                if (next.value.length !== 0) {
                    position += next.value.length
                    return next.value
                }
            }
        })
        queue = pull.catch(() => undefined)
        return pull
    }
}

/**
 * The runner's own answer, for the one case a listener never gets to give one:
 * a listener that threw.
 *
 * **It closes the connection**, which is the whole difference between refusing
 * a request and surviving the refusal. A throw can land before the listener has
 * read the request to its end, and on a keep-alive connection Node then waits
 * for the rest of a body that is never coming — the socket is stuck, and the
 * next request on it is never answered. A client that declares ten megabytes
 * and sends a hundred kilobytes could hold connections open that way for as
 * long as it liked. Draining the remainder would be the polite alternative and
 * the wrong one: it reads bytes this server has already decided it will not
 * use. {@link answerRequest} applies that same argument to a listener that
 * answers without reading its body.
 *
 * @type {(res: _ServerResponse) => (status: number) => (message: string) => void}
 */
const respondWith = res => status => message => {
    const body = textEncoder.encode(`${message}\n`)
    res
        .writeHead(status, {
            'content-type': 'text/plain; charset=utf-8',
            'content-length': `${body.length}`,
            connection: 'close',
        })
        .end(body)
}

/**
 * The whole HTTP response to a `CONNECT`, as bytes on a raw socket.
 *
 * Written by hand rather than through {@link respondWith}, because the `connect`
 * event hands over a socket and not a `ServerResponse` — there is no object to
 * ask for a status line.
 *
 * @type {string}
 */
const connectRefusal =
    'HTTP/1.1 501 Not Implemented\r\n'
    + 'content-type: text/plain; charset=utf-8\r\n'
    + 'content-length: 26\r\n'
    + 'connection: close\r\n'
    + '\r\n'
    + 'this server cannot tunnel\n'

/**
 * Answers one request through `listener`, or explains that it could not.
 *
 * **The request body is a stream the listener pulls**, so nothing about its size
 * is this function's business any more. It used to buffer the body first and
 * answer `413` past the `Vec` cap, because `IncomingMessage.body` was one `Vec`
 * and a larger request had no value to arrive as. What is left of `413` in this
 * server is nothing: a listener with a size policy of its own is the party that
 * should answer it, and it can, because it sees the request before the bytes.
 *
 * **A body the listener did not finish reading closes the connection.** The
 * question is what to do with bytes a client is still sending for a request that
 * has already been answered, and there are two answers: read them and throw them
 * away, or stop. {@link respondWith} argues it for the runner's own refusals —
 * draining reads bytes the server has already decided not to use, and a client
 * declaring ten megabytes and sending a hundred kilobytes would hold a
 * connection for as long as it liked — and a listener answering early is the
 * same shape, so it gets the same answer. Node's own choice is the other one:
 * its `resOnFinish` calls `req._dump()` for a body nobody consumed, which waits
 * at the client's pace for the rest and discards it. So the runner has to say
 * something, and what it says is `connection: close`. What that changes is the
 * waiting, not the discarding: Node still throws away whatever had already
 * arrived, and the socket stops being held for whatever had not.
 *
 * `connection: close` rather than destroying the socket, because the client is
 * then *told* rather than cut off: Node flushes the whole answer and closes
 * after it, where a `res.destroy()` races the flush and turns a complete
 * response into an `ECONNRESET` (`./todo/streaming-http-bodies.md` measures that
 * table). Measured on Darwin with Node 23.11.0: a 200,000-byte answer to an
 * unread 300,000-byte `POST` arrived whole, carried `connection: close`, and the
 * next request on the same keep-alive agent took a fresh socket.
 *
 * **The predicate is `req.complete`, and reading it after the listener has
 * answered is what makes it right.** It is Node's own record of whether the
 * whole request has arrived and been parsed, so nothing here restates a framing
 * rule. Measured the same way, it is `false` *synchronously* at the listener's
 * first statement even for a bodiless `GET` — message-complete has not been
 * reached yet — and `true` one microtask later; running the listener's effect is
 * an `await`, so by the time there is a response to write, a request with no
 * body reads `true` and keeps its connection. A body still arriving reads
 * `false` however long it is waited on, which is the case this closes for. A
 * body that is short enough to have arrived already may read either, and both
 * readings are right: the flag is a statement about what has been received, not
 * a guess about what will be.
 *
 * **The response body goes out a chunk at a time**, because it is however many
 * `Vec`s the answer takes and one `res.end` carries one. The writes are offered
 * and not paced: every chunk is already in memory when the status goes out, so
 * `res.write`'s `false` names a buffer nothing is still filling. It also says
 * nothing for a `HEAD`, a `204` or a `304`, where Node answers `true` to a write
 * it discards — so Node is the party that drops such a body here, across as many
 * writes as the body has, and `./proof.mjs` pins that.
 *
 * `unwrap` is total here: a `RequestListener` answers
 * `Effect<…, ServerResponse, never>`, because the response frame *is* where a
 * listener puts its failures.
 *
 * @type {(listener: Erl<NodeOp>) => _RequestListener}
 */
const answerRequest = listener => async (req, res) => {
    const { method, url, headers } = req
    const { status, headers: outHeaders, body: outBody } = unwrap(await runNodeEffect(listener({
        method,
        url,
        headers,
        body: requestBody(asNominal(requestBodyReader(req))),
    })))
    if (!req.complete) { res.setHeader('connection', 'close') }
    res.writeHead(status, outHeaders)
    for (const chunk of outBody) {
        res.write(fromVec(chunk))
    }
    res.end(emptyBody)
}

/**
 * What a request gets when answering it threw.
 *
 * Once the listener has started writing there is no status left to change, so
 * the only thing owed is an end to the response — leaving it open would hang
 * the connection until it times out.
 *
 * @type {(res: _ServerResponse) => void}
 */
const failSafe = res => {
    if (res.headersSent) {
        res.end(emptyBody)
        return
    }
    respondWith(res)(500)('internal server error')
}

const { mkdir, open, readFile, readdir, rename, writeFile, rm, rmdir, access, stat, lstat } = fs.promises

const { exec } = childProcess

const maxFileSizeBytes = Number(maxLengthBytes)

const textEncoder = new TextEncoder()

const emptyBody = new Uint8Array()

const prefix = /** @type {const} */ ('file:///')

/** @type {(v: string) => Promise<Module>} */
const asyncImport = v => {
    const s0 = v.includes(':') ? v : concat(process.cwd())(v)
    const s1 = s0.startsWith(prefix) ? s0 : `${prefix}${s0}`
    return import(s1)
}


/** @type {(p: unknown) => Promise<readonly [unknown]>} */
const awaitPromise = async p =>
    [p instanceof Promise ? await p : p]

const { now } = Date

/** Maps `WriteConsoles` names to the corresponding Node.js writable streams.
 * @type {{ readonly [k in WriteConsoles]: NodeJS.WritableStream }}
 */
const streams = {
    stdout: process.stdout,
    stderr: process.stderr,
}

/**
 * Writes `data` to `stream` respecting Node.js backpressure.
 *
 * `stream.write()` returns `false` when the internal buffer is full; the data
 * is already buffered at that point (no retry needed) but the caller must not
 * issue more writes until the `'drain'` event fires. Waiting here throttles the
 * producer to the speed of the OS consumer, preventing unbounded memory growth
 * when many large messages arrive faster than they can be flushed.
 *
 * When the buffer is not full `write()` returns `true` and we return
 * immediately, so large computations with occasional prints never stall.
 *
 * @see {@link https://nodejs.org/api/stream.html#writablewritechunk}
 * @type {(stream: NodeJS.WritableStream, data: Uint8Array) => Promise<void>}
 */
const writeAll = async (stream, data) => {
    if (!stream.write(data)) {
        await once(stream, 'drain')
    }
}

/**
 * Resolves `true` once stdin reaches EOF, or `false` as soon as more data is
 * readable. Both listeners are removed the moment either fires, so a
 * long-running server that idles between messages never accumulates leftover
 * `'readable'`/`'end'` listeners (which would eventually trip
 * `MaxListenersExceededWarning`).
 * @type {(stdin: NodeJS.ReadStream) => Promise<boolean>}
 */
const waitReadableOrEnd = stdin =>
    new Promise(resolve => {
        const cleanup = () => {
            stdin.removeListener('readable', onReadable)
            stdin.removeListener('end', onEnd)
        }
        const onReadable = () => { cleanup(); resolve(false) }
        const onEnd = () => { cleanup(); resolve(true) }
        stdin.once('readable', onReadable)
        stdin.once('end', onEnd)
    })

/**
 * Reads one byte from `process.stdin`, or `null` at EOF.
 *
 * `read(1)` returns `null` both at end-of-stream and when no byte is buffered
 * yet, so the two are told apart by waiting on `'readable'` (more data) vs
 * `'end'` (EOF). The line framing lives in the pure `readLine` combinator; this
 * interpreter is deliberately just "next byte".
 * @type {() => Promise<number | null>}
 */
const readStdinByte = async () => {
    const stdin = process.stdin
    while (true) {
        const chunk = stdin.read(1)
        if (chunk !== null) {
            return chunk[0]
        }
        if (stdin.readableEnded) {
            return null
        }
        if (await waitReadableOrEnd(stdin)) {
            return null
        }
    }
}

/**
 * Runs `f` over a descriptor opened on `path` with `flags`, and closes the
 * descriptor on every exit — the bracket the descriptor handlers below share.
 *
 * @type {(path: string, flags: string) => <T>(f: (fh: FileHandle) => Promise<T>) => Promise<T>}
 */
const withOpen = (path, flags) => async f => {
    const fh = await open(path, flags)
    try {
        return await f(fh)
    } finally {
        await fh.close()
    }
}

/**
 * Fills `buffer` from `fh`, starting at `position`, and answers the filled
 * prefix: all of `buffer`, or less only at the end of the file. `position`
 * `null` reads at the descriptor's own cursor and advances it.
 *
 * One `read` may answer less than it was asked for without the file being at
 * its end: a positional read of `/proc/self/maps` answers 4,007 bytes for a
 * 1 MiB request and 4,034 more at the next offset, measured on node 22, and a
 * network or virtual filesystem may do the same for a file a caller believes
 * is ordinary. So the buffer is filled rather than read once, and a short
 * answer then means the end of the file — which is what every caller of
 * `readBytes` and `readWhole` already assumes. `fjs/cas`'s streams advance by a
 * whole chunk and stop only on an empty read, so without the loop a short read
 * there would drop bytes out of the middle of a content-addressed file.
 *
 * @type {(fh: FileHandle, buffer: Buffer, position: number | null) => Promise<Buffer>}
 */
const fill = async (fh, buffer, position) => {
    let taken = 0
    while (taken < buffer.length) {
        const { bytesRead } = await fh.read(buffer, taken, buffer.length - taken, position === null ? null : position + taken)
        if (bytesRead === 0) {
            break
        }
        taken += bytesRead
    }
    return buffer.subarray(0, taken)
}

const randomMax = Number(1n << 32n)

const { randomInt } = crypto

/** @type {<T, E>(effect: Effect<NodeOp, T, E>) => Promise<Result<T, E>>} */
const runNodeEffect = asyncRun({
    ...memoryOperationMap(),
    all: async (...effects) => ok(await Promise.all(effects.map(runNodeEffect))),
    fetch: url => io(async () => {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Fetch error: ${response.status} ${response.statusText}`)
        }
        return toVec(new Uint8Array(await response.arrayBuffer()))
    }),
    mkdir: (path, options) => io(async () => { await mkdir(path, options) }),
    resolveFileModule: (name, parent) => io(async () => {
        if (parent !== null && decodeImportPath(name) === null) {
            throw new Error('invalid module specifier')
        }
        const url = parent === null ? pathToFileURL(name) : new URL(name, parent)
        if (url.protocol !== 'file:') {
            throw new Error('only file modules are supported')
        }
        const loadingPath = fileURLToPath(url)
        const path = await fs.promises.realpath(loadingPath)
        return { id: pathToFileURL(path).href, path }
    }),
    readFile: path => io(async () => {
        const fileStats = await stat(path)
        // if the file is too big, toVec should fail anyway but in this case we don't want to load the file.
        if (fileStats.size > maxFileSizeBytes) {
            throw new Error(`File size ${fileStats.size} exceeds maximum allowed size of ${Number(maxFileSizeBytes)} bytes: '${path}'`)
        }
        return toVec(await readFile(path))
    }),
    readdir: (path, r) => io(async () =>
        (await readdir(path, { ...r, withFileTypes: true }))
        .map(v => ({
            name: v.name,
            parentPath: normalize(v.parentPath),
            isFile: v.isFile(),
            isDirectory: v.isDirectory()
        }))
    ),
    // A `Vec` that is not whole bytes never reaches here: the effect in
    // `module.f.mjs` refuses it before the host is asked, since `fromVec` would
    // pad the last byte.
    writeFile: (path, data) => io(() => writeFile(path, fromVec(data))),
    rm: path => io(() => rm(path)),
    // A link is refused before `rmdir` is asked, because Windows would remove it:
    // a directory link there is a junction or a directory symlink, and
    // `RemoveDirectoryW` removes the reparse point whatever the target holds,
    // where POSIX `rmdir` answers `ENOTDIR` for a link. The contract is `ENOTDIR`
    // on every host (`Rmdir` in `./types.ts`), so a prune never removes a link
    // to a directory of refs. The `lstat` does not follow the link; a link that
    // appears between it and the `rmdir` is not caught, the same window every
    // check-then-act by name has here.
    rmdir: path => io(async () => {
        if ((await lstat(path)).isSymbolicLink()) {
            throw Object.assign(new Error(`ENOTDIR: not a directory, rmdir '${path}'`), { code: 'ENOTDIR' })
        }
        return rmdir(path)
    }),
    rename: (src, dst) => io(() => rename(src, dst)),
    // The handle carries the reader itself, which is the whole of what a
    // `Nominal` over `unknown` is for: the position a request body is at is one
    // request's, and a closure is the only place it belongs. `asBase` reads it
    // back, exactly as `listen` reads a `Server` back below.
    //
    // `toVec` here rather than in the reader, so a chunk past the `Vec` cap is
    // refused through `io` like any other host failure rather than as a throw
    // nobody catches.
    readRequestBytes: (body, offset, size) => io(async () =>
        toVec(await (/** @type {_RequestBodyReader} */ (asBase(body)))(offset, size))),
    readBytes: (path, offset, size) => io(async () => {
        if (offset < 0) {
            throw new Error(`Offset ${offset} is negative`)
        }
        if (size > maxFileSizeBytes) {
            throw new Error(`Chunk size ${size} exceeds maximum allowed size of ${maxFileSizeBytes} bytes`)
        }
        return withOpen(path, 'r')(async fh => toVec(await fill(fh, Buffer.alloc(size), offset)))
    }),
    // One open for the whole file, which is the point of the operation: a caller
    // reading in windows through `readBytes` opens the path per window and can
    // straddle two files, since each open resolves the name again. `git
    // pack-refs` replaces `packed-refs` by rename on every run, so that is not a
    // rare race — and where the replacement is the same length, every window is
    // exactly as long as it should be and the join is an old prefix on a new
    // suffix that still parses.
    //
    // The kind is checked before the open rather than after it, because opening
    // a FIFO with no writer blocks until one appears — there is no answer to
    // wait for. That leaves a window between the `stat` and the `open` in which
    // the path could become one, which is the host's own race and not one this
    // operation creates; what it removes is the race *between* reads.
    //
    // Each chunk is filled at the descriptor's own cursor, so a chunk that comes
    // back short of its buffer is the end.
    readWhole: path => io(async () => {
        const s = await stat(path)
        if (!s.isFile()) {
            throw Object.assign(new Error(notAFileMessage(path)), { code: notAFileCode })
        }
        return withOpen(path, 'r')(async fh => {
            // Rebuilt rather than appended to, and serving an arbitrary file
            // does not change that. A window is a fixed 128 KiB, so the count
            // is the file's size divided by it — a gigabyte is some eight
            // thousand windows, and the tens of millions of *reference* copies
            // that rebuild costs are noise beside reading the gigabyte itself.
            // The collector that did mutate was the request body's, and its
            // count was not the byte count at all: a client picked it, and
            // 20,000 one-byte chunks are 20 KB. It is gone with the cap, in
            // this same change. A fixed window leaves no such gap between size
            // and count, so §3.1 has no exception to spend here.
            //
            // Holding a whole file to answer one request is the real cost, and
            // `./todo/streaming-http-bodies.md` stage 1 is where it goes away —
            // `fjs/web` stops asking for the file at all and reads chunks
            // through a handle instead.
            let chunks = /** @type {readonly Vec[]} */ ([])
            for (;;) {
                const chunk = await fill(fh, Buffer.alloc(maxFileSizeBytes), null)
                if (chunk.length !== 0) {
                    chunks = [...chunks, toVec(chunk)]
                }
                if (chunk.length < maxFileSizeBytes) {
                    return chunks
                }
            }
        })
    }),
    // `maxOutputLength` is what makes the bound a refusal rather than a
    // truncation: Node stops inflating and throws `ERR_BUFFER_TOO_LARGE`, so
    // a stream that would inflate past the `Vec` cap costs the cap and not
    // whatever it held. And zlib stops at the end of the stream, whatever
    // follows it, so the bytes it took are counted against the bytes given:
    // a loose object with bytes after its stream is one Git refuses as
    // garbage at its end, and this must not hand back the object in front.
    // A `Vec` that is not whole bytes never reaches here: the effect in
    // `module.f.mjs` refuses it before the host is asked.
    inflate: data => io(async () => {
        const input = fromVec(data)
        // `info: true` answers `{ buffer, engine }`, an overload the Node
        // typings do not spell, so the shape is stated here, once, at the
        // boundary.
        const { buffer, engine } = /** @type {{ readonly buffer: Uint8Array, readonly engine: { readonly bytesWritten: number } }} */
            (/** @type {unknown} */ (zlib.inflateSync(input, { info: true, maxOutputLength: maxFileSizeBytes })))
        if (engine.bytesWritten !== input.length) {
            throw Object.assign(new Error(inflateTrailingMessage(input.length - engine.bytesWritten)), { code: inflateTrailingCode })
        }
        return toVec(buffer)
    }),
    randomInt: async () => ok(randomInt(randomMax)),
    access: path => io(() => access(path)),
    createExclusive: path => io(async () => {
        const fh = await open(path, 'wx')
        await fh.close()
    }),
    // One open, `wx` rather than `w`, and the rollback here rather than at the
    // caller — all three are the contract, and the third is why this is not
    // `writeFile(path, data, { flag: 'wx' })`. `O_EXCL` succeeding is the only
    // evidence that the file is *this* call's, and it exists on this side of the
    // boundary alone: a caller holding an error code cannot tell a write that
    // failed after creating the file from an open that never created one.
    // Measured on node 22.22.2, with descriptors exhausted, a `wx` open of a
    // name another writer holds answers `EMFILE` and not `EEXIST` — so "every
    // error but `EEXIST` means I created it" is wrong, and a caller that cleaned
    // up on it would unlink somebody else's file.
    //
    // So the file either exists holding `data` or does not exist, and nothing
    // above needs to reason about which. Git's lockfile does the same from the
    // same knowledge: it writes through the descriptor it opened and its
    // `rollback_lock_file` unlinks.
    writeExclusive: (path, data) => io(async () => {
        const fh = await open(path, 'wx')
        let failure = null
        try {
            await fh.writeFile(Buffer.concat(data.map(fromVec)))
        } catch (e) {
            failure = e
        }
        // Not in a `finally`: a failure to close must not replace the write's,
        // which is the one a caller can act on. If the close itself fails the
        // file is left behind, which is a stale lock on a filesystem already
        // failing — recorded in `fjs/git/refstore/todo/ref-writing.md`.
        await fh.close()
        if (failure !== null) {
            await rm(path, { force: true })
            throw failure
        }
    }),
    // As for `writeFile`: a `Vec` that is not whole bytes is refused before here.
    writeBytes: (path, offset, data) => io(() => withOpen(path, 'r+')(async fh => {
        const buffer = fromVec(data)
        // Loop over short writes so the whole Vec lands — a partial pwrite would
        // leave a hole the publish-time size check could pass over.
        let written = 0
        while (written < buffer.length) {
            const { bytesWritten } = await fh.write(buffer, written, buffer.length - written, offset + written)
            written += bytesWritten
        }
    })),
    stat: path => io(async () => {
        const s = await stat(path)
        return { size: s.size, isFile: s.isFile(), isDirectory: s.isDirectory() }
    }),
    import: path => io(() => asyncImport(path)),
    exec: (command, stdin) => new Promise(resolve => {
        const child = exec(command, (e, stdout, stderr) =>
            resolve(e !== null ? error(toIoError(e)) : ok({ stdout, stderr }))
        )
        child.stdin?.end(stdin)
    }),
    createServer: async requestListener => {
        const answer = answerRequest(/** @type {Erl<NodeOp>} */ (requestListener))
        // **Nothing may escape this handler.** Node does not await the promise
        // an `async` request listener returns, so a throw inside one becomes an
        // unhandled rejection and ends the *process*: one request, and the
        // whole server is gone. A panic must not outlive the request that
        // caused it, so the answer is caught here and the fallback — itself
        // able to throw on a socket that has since died — is caught too.
        /** @type {_RequestListener} */
        const nodeRl = async (req, res) => {
            const r = await asyncTryCatch(() => answer(req, res))
            if (r[0] === 'error') { tryCatch(() => failSafe(res)) }
        }
        const server = createServer(nodeRl)
        // A `CONNECT` never reaches the listener: Node routes it to the
        // `connect` event, and with no handler there it drops the socket
        // without a byte of HTTP — checked on Linux with Node 22.22.2, where
        // `CONNECT localhost:18084 HTTP/1.1` closed the connection while a
        // `POST` to the same server was answered. A client that asked a
        // question deserves an answer, so the runner gives the one it can.
        //
        // `501`, not `405`. A `405` must carry `Allow` (RFC 9110 §15.5.6) and
        // only the listener knows what it allows, while `501` is exactly what
        // RFC 9110 §15.6.2 describes — a method the server cannot support for
        // any resource. That is true of *every* server this effect layer can
        // build: `RequestListener` maps a request frame to a response frame and
        // has no vocabulary for a tunnel, so no listener could answer a
        // `CONNECT` even if it were handed one.
        //
        // Answering here rather than passing it on follows the `500` above: the
        // runner answers on the listener's behalf exactly when the listener
        // structurally cannot. The `413` that used to stand beside it is gone —
        // a request body is a stream now, so there is no size a listener cannot
        // be handed.
        server.on('connect', (_, socket) => { tryCatch(() => socket.end(connectRefusal)) })
        return ok(/** @satisfies {EffectServer} */ (asNominal(server)))
    },
    // Binding is asynchronous, and its failure arrives as an `error` event
    // rather than a throw: answering `ok` the moment `listen` was *called*
    // reported a server that never started, and Node then killed the process
    // with an unhandled `EADDRINUSE` — after the program had already printed
    // the URL it was serving. So this settles on the outcome, not on the call.
    listen: (server, port, host) => io(() => new Promise((resolve, reject) => {
        const s = /** @type {_Server} */ (asBase(server))
        // An empty host is the trap this operation's required `host` argument
        // exists to close, so it is refused rather than forwarded. Node treats
        // `''` exactly as it treats an omitted argument and binds the
        // unspecified address — `0.0.0.0` on Linux with Node 22.22.2 and `::`
        // on Darwin with Node 23.11.0, a different address each and the same
        // mistake — which is how a missing configuration value publishes a
        // server on every interface while the program believes it stated an
        // address. A program that wants every interface says `'0.0.0.0'` or
        // `'::'` and means it.
        //
        // The error is Node's own code and message shape for an argument it
        // rejects, since a caller reading `IoError.code` should not have to
        // learn a second vocabulary for a refusal that is this runner's own.
        if (host === emptyHost) {
            reject(Object.assign(new Error(emptyHostMessage), { code: emptyHostCode }))
            return
        }
        // Each handler removes the other, so exactly one outcome is recorded and
        // neither is left attached. `once` only removes the handler that fired:
        // a failed bind used to leave its `listening` handler behind, and a
        // caller retrying after an `EADDRINUSE` accumulated one per attempt
        // until Node warned about the leak.
        /** @type {() => void} */
        const onListening = () => {
            // A later `error` event is not this effect's to answer, and a
            // handler still holding `reject` would swallow it into an
            // already-settled promise.
            s.removeListener('error', onError)
            resolve(undefined)
        }
        /** @type {(e: unknown) => void} */
        const onError = e => {
            s.removeListener('listening', onListening)
            reject(e)
        }
        s.once('error', onError)
        s.once('listening', onListening)
        // `listen` can also fail *synchronously* — an out-of-range port throws
        // `ERR_SOCKET_BAD_PORT`, an already-listening server throws too — and a
        // throw here would reject the promise past both handlers, leaving them
        // attached: 20 attempts, 20 stale `error` handlers, each holding a
        // `reject` that can never fire and would swallow a later error into an
        // already-settled promise. So the synchronous path cleans up after
        // itself, exactly as the two event paths do.
        const started = tryCatch(() => s.listen(port, host))
        if (started[0] === 'error') {
            s.removeListener('error', onError)
            s.removeListener('listening', onListening)
            reject(started[1])
        }
    })),
    forever: () => new Promise(() => {}),
    now: async () => ok(now()),
    // `sandbox` and `catch` are every host's, so node spreads them rather than
    // writing a second copy: `../common/module.mjs`.
    ...commonOperationMap,
    await: async p => ok(await awaitPromise(p)),
    write: async (stream, data) => ok(await writeAll(streams[stream], fromVec(data))),
    read: async () => ok(await readStdinByte()),
    test: async (ctx, name, expectFailure, test) =>
        // The body's answer is `ok(undefined)` — a `Test` callback absorbs its
        // own failures by panicking, which is the only signal these frameworks
        // read — so it is awaited and discarded rather than returned.
        ok(await ctx.test(name, { expectFailure }, async t => { await runNodeEffect(test(t)) })),
})

/** @type {TestFn} */
const inlineTest = async (name, { expectFailure }, fn) => {
    if (expectFailure) {
        try { await fn(inlineContext) } catch { return }
        throw new Error(`expected to throw: ${name}`)
    } else {
        await fn(inlineContext)
    }
}

/** @type {TestContext} */
const inlineContext = { test: inlineTest }

/** @type {(register: (name: string, fn: () => Promise<void>) => Promise<void>) => TestContext} */
const wrapInlineTest = register => ({
    test: (name, opts, fn) => register(name, () => inlineTest(name, opts, fn))
})

const bunTestContext = wrapInlineTest(testContext.test)

const engine = 'Bun' in globalThis ? 'bun' :
    'Deno' in globalThis ? 'deno' : 'node'
const nodeVersion = engine === 'node' ? process.version : undefined
const inlineTestContext = usesInlineTestContext(engine, nodeVersion)

/** @type {NodeProgramOptions} */
const options = {
    args: process.argv.slice(2),
    env: process.env,
    home: toPosix(os.homedir()),
    std: { stdout: process.stdout, stderr: process.stderr },
    testContext: inlineTestContext ? wrapInlineTest(testContext.test) : testContext,
    bunTestContext,
    engine,
    ...(nodeVersion === undefined ? {} : { nodeVersion }),
    inlineTestContext,
}

/**
 * Runs a `NodeProgram` against the real Node globals and process arguments,
 * resolving to its exit code **without** terminating the process.
 *
 * Use this when the caller must stay alive afterwards — e.g. when proofs are
 * registered under an external test runner (Node `--test`, Bun, Deno) that owns
 * the process lifecycle. For a standalone CLI entry point that should exit with
 * the program's code, use {@link run} instead.
 * @type {(p: NodeProgram) => Promise<number>}
 */
export const runEffect = async program =>
    exitCode(await runNodeEffect(program(options)))

/**
 * CLI entry point: runs a `NodeProgram` via {@link runEffect}, then calls
 * `process.exit` with its exit code. The `Promise<never>` return type reflects
 * that control never returns to the caller — the process terminates.
 *
 * A `bin` script can simply
 * `import { run } from '.../fjs/effects/node/module.mjs'; await run(main)`.
 * @type {(p: NodeProgram) => Promise<never>}
 */
export const run = async p =>
    process.exit(await runEffect(p))
