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
 * @import { Effect, IoChannel } from '../types.ts'
 * @import { Handle, IoResult, Server as EffectServer, Module, NodeOp, RequestListener as Erl, NodeProgram, NodeProgramOptions, ServerResponse, WriteConsoles, TestContext, TestFn, } from './types.ts'
 * @import { _CloseRecord, _Readable, _RequestListener, _Server, _ServerResponse } from './private.ts'
 * @import { Next } from '../list/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
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
    notAFileCode, notAFileMessage, refusalMessage, refusedStatus, responseGate, runnerResponse, toIoError,
    usesInlineTestContext,
} from './module.f.mjs'
import { asBase, asNominal } from '../../types/nominal/module.f.mjs'
import { error, ok, unwrap } from '../../types/result/module.f.mjs'
import { asyncTryCatch, tryCatch } from '../../types/result/module.mjs'
import { fromVec, listToVec, toVec } from '../../types/uint8array/module.f.mjs'
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
 * Reads a request body, giving up at the `Vec` cap rather than at the point
 * where converting it would throw.
 *
 * `listToVec` on an oversized body throws *after* the whole thing has been
 * buffered, which is the wrong end of the problem twice over: the memory is
 * already spent, and the throw lands inside an `async` request handler whose
 * promise nobody awaits. Counting as the chunks arrive stops both.
 *
 * **The accumulator is mutated, deliberately.** Rebuilding the array per chunk
 * — `result = [...result, a]`, the shape the rest of this repository is written
 * in — copies every chunk received so far on every chunk received, which is
 * quadratic in the *number* of chunks. The byte cap does not bound that: 20,000
 * one-byte chunks are 20 KB and 200 million copies, and took 2,794 ms of event
 * loop to reach an answer the server had already decided on — 167 ms now, and
 * the growth went from ×4 per doubling to ×2. A cap on payload size is not a cap
 * on chunk count, and a request that will be refused must not cost more than one
 * that is served. The array never leaves this function before it
 * is finished, so nothing observes the mutation — which is the condition under
 * which the impure shell is allowed to be impure.
 *
 * @param {_Readable} v
 * @returns {Promise<Nullable<readonly Uint8Array[]>>} `null` past the cap.
 */
const collectBounded = async v => {
    /** @type {Uint8Array[]} */
    const result = []
    let size = 0
    for await (const a of v) {
        size += a.length
        if (size > maxFileSizeBytes) { return null }
        result.push(a)
    }
    return result
}

/**
 * The runner's own answer, for the cases a listener never gets to give one — a
 * request body too large to hand it, a listener that threw — and for the two the
 * gates refuse.
 *
 * The frame is {@link runnerResponse}'s, shared with the virtual runner so that a
 * refusal a program is proven against is the refusal it meets. **It closes the
 * connection**, which is the whole difference between refusing a request and
 * surviving the refusal; that argument lives with the frame.
 *
 * @type {(res: _ServerResponse) => (status: number) => (message: string) => void}
 */
const respondWith = res => status => message => {
    const { headers, body } = runnerResponse(status, message)
    res.writeHead(status, headers).end(fromVec(body[0]))
}

/**
 * Whether the client has gone, as a value the runner **records** rather than an
 * edge the pump listens for.
 *
 * `answerRequest` is handed `res` before it calls the listener, which is early
 * enough. A pump is the last thing a request does, and `fjs/web`'s listener opens
 * a handle and `fstat`s it before it has a status to return — so a cancelled
 * download arriving a few milliseconds earlier closes the response while nothing
 * is watching. Measured on Darwin with Node 26.8.1 and reproduced on 22.23.2, the
 * client destroyed 111 ms in and the listener returning at 300: `close` fired at
 * 112 ms, `writeHead` then raised nothing and set `headersSent`, the first
 * `res.write` answered `false` like any full buffer, and the wait on `drain` never
 * ended — because `drain` does not come for a socket that has gone and `close`
 * does not come twice. Nothing ended that pump, so nothing ran `release`, and the
 * handle it held was held for the life of the process.
 *
 * Two things follow from recording it. A response already closed when the listener
 * returns is not answered at all, and the park is a race between `drain` and the
 * record rather than between `drain` and a second `close` — so a closure that
 * already happened wins it at once instead of never arriving.
 *
 * @type {(res: _ServerResponse) => _CloseRecord}
 */
const recordClose = res => {
    /** @type {_CloseRecord} */
    const record = { closed: false, waiting: new Set() }
    res.on('close', () => {
        record.closed = true
        // Copied before waking: each waiter removes itself from the set.
        for (const wake of [...record.waiting]) { wake() }
    })
    return record
}

/**
 * Waits for the response's buffer to drain, **or** for the client to have gone.
 *
 * `res.write` answering `false` is the only memory bound a lazy body has: measured
 * on Darwin with Node 23.11.0 against a client that asked and then read nothing,
 * the first 131,072-byte write already answered `false` — the default high-water
 * mark being 16 KiB — and a pump that wrote on regardless left all 26,216,371
 * bytes of a 25 MiB body resident for one request.
 *
 * And `drain` is not the only way out of that wait. Measured the same way with the
 * pump parked: ten chunks written, the client destroyed at 1,023 ms, `close` on
 * the response at 1,026 ms — and the pump still parked three seconds later,
 * because `drain` never comes for a socket that has gone. Waiting on `drain` alone
 * does not throttle a body so much as strand one, holding its reads open for as
 * long as the process lives. So a recorded `close` releases the park as surely as
 * `drain` does, and the one resolver serves both triggers: whichever fires removes
 * the `drain` listener and forgets the waiter, so neither leaks.
 *
 * @type {(res: _ServerResponse, record: _CloseRecord) => Promise<void>}
 */
const park = (res, record) => new Promise(resolve => {
    if (record.closed) {
        resolve(undefined)
        return
    }
    /** @type {() => void} */
    const wake = () => {
        res.removeListener('drain', wake)
        record.waiting.delete(wake)
        resolve(undefined)
    }
    record.waiting.add(wake)
    res.on('drain', wake)
})

/**
 * Pulls the body one cell at a time and writes it at the socket's pace, counting
 * the bytes against the length the listener declared.
 *
 * **The runner counts, because that bound is one producer's discipline and
 * `ServerResponse<O>` is everyone's.** `fjs/web` can be trusted to stop at the
 * `fstat` size because it writes both the header and the fold; nothing in the type
 * ties them together, and a `Content-Length` that disagrees with the body is
 * ordinary code rather than an abuse. Measured on Darwin with Node 26.8.1 and
 * reproduced on 22.23.2, a response declaring 131,072 bytes and writing 1,000 more
 * put all 132,072 on the wire and `res.end()` raised nothing: the keep-alive client
 * failed `HPE_INVALID_CONSTANT` on the **in-flight** response, the surplus parsed
 * as the following status line, so the request being answered was lost along with
 * the one after it. The other direction is as quiet: 65,536 bytes written of a
 * declared 131,072, and nothing on the server side notices — `writableFinished` is
 * `true` and the socket goes back into the keep-alive pool, while two pipelined
 * requests came back as one 131,342-byte stream whose second status line sat well
 * inside body 1's declared window.
 *
 * So a chunk that would carry the count past the declared length is a failed cell:
 * **none of it is written**, and the socket is destroyed. Writing its first
 * `bound − written` bytes and ending cleanly is the other choice and the wrong one,
 * because a body exactly as long as it promised is a body every client reads as
 * whole. A body that ends short of the length destroys for the same reason, and at
 * once rather than at the idle timeout.
 *
 * @type {(res: _ServerResponse, record: _CloseRecord, bound: Nullable<number>, body: Effect<NodeOp, Next<NodeOp, Vec, IoChannel>, IoChannel>) => Promise<void>}
 */
const pumpBody = async (res, record, bound, body) => {
    let e = body
    let written = 0
    for (;;) {
        // A recorded `close` ends the pump as surely as `drain` releases it: it
        // stops pulling, and the producer's reads stop with it. A client that
        // hangs up is the ordinary case — a cancelled download, a closed tab.
        if (record.closed) { return }
        const cell = await runNodeEffect(e)
        // A cell that fails after the headers are written must destroy the socket
        // rather than end the response: measured, one 131,072-byte chunk written
        // under chunked framing and then a failure, `res.end()` left the client a
        // clean, complete 131,072-byte response with `res.complete` true and no
        // error raised.
        if (cell[0] === 'error') {
            res.destroy()
            return
        }
        const node = cell[1]
        if (node === undefined) {
            if (bound !== null && written !== bound) {
                res.destroy()
                return
            }
            res.end(emptyBody)
            return
        }
        const chunk = fromVec(node.first)
        if (bound !== null && written + chunk.length > bound) {
            res.destroy()
            return
        }
        written += chunk.length
        e = node.tail
        if (!res.write(chunk)) { await park(res, record) }
    }
}

/**
 * Writes one response: the gates in their stated order, then the body.
 *
 * A response **already closed** when the listener returned is not answered at all
 * — no `writeHead`, no gates, no pull. A status written to a client that has gone
 * is a `writeHead` that silently sets `headersSent` on a destroyed socket, and
 * `headersSent` is the flag {@link failSafe} reads to decide that a status is no
 * longer available.
 *
 * @type {(res: _ServerResponse, record: _CloseRecord, method: string, answer: ServerResponse<NodeOp>) => Promise<void>}
 */
const deliver = async (res, record, method, { status, headers, body }) => {
    if (record.closed) { return }
    const gate = responseGate(method, res.useChunkedEncodingByDefault, status, headers)
    if (gate[0] === 'framingHeader' || gate[0] === 'unframed') {
        respondWith(res)(refusedStatus)(refusalMessage(gate))
        return
    }
    if (gate[0] === 'noBody') {
        res.writeHead(status, headers).end(emptyBody)
        return
    }
    res.writeHead(status, headers)
    await pumpBody(res, record, gate[1], body)
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
 * A **request** body past the cap never reaches the listener:
 * `IncomingMessage.body` is a single `Vec`, so there is no request value to
 * build, and `413` is the accurate answer rather than a truncated one. Streaming
 * request bodies lift that limit too — see `./todo/streaming-http-bodies.md`,
 * stage 2.
 *
 * **The response body is pulled, one cell at a time, at the socket's pace** —
 * {@link pumpBody}. Closure is recorded before the listener runs
 * ({@link recordClose}), because the listener may hold something before it has a
 * status to return.
 *
 * **`release` runs exactly once, on every exit.** Every one of them stops short of
 * the far end of the body, which is the only place a `close` cell could sit: a
 * response closed before the pump starts is never answered, the gates refuse or
 * suppress before the first pull, a recorded `close` ends the pump wherever the
 * client hung up, a count that disagrees destroys, a failed cell destroys, and a
 * continuation that *throws* leaves through {@link failSafe}. Only a response that
 * runs to its end reaches the far end, which is the one case nobody was worried
 * about. So the `finally` is what makes it once and always — the throw included,
 * since `createServer`'s wrapper catches that one after this has released.
 *
 * `unwrap` is total here: a `RequestListener` answers
 * `Effect<…, ServerResponse<O>, never>`, because the response frame *is* where a
 * listener puts its failures.
 *
 * @type {(listener: Erl<NodeOp>) => _RequestListener}
 */
const answerRequest = listener => async (req, res) => {
    const record = recordClose(res)
    const body = await collectBounded(req)
    if (body === null) {
        respondWith(res)(413)('request body too large')
        return
    }
    const { method, url, headers } = req
    const answer = unwrap(await runNodeEffect(listener({
        method,
        url,
        headers,
        body: listToVec(body),
        // Node's own answer, which the runner has in hand and no `.f.mjs` could
        // compute — see `IncomingMessage.chunkedResponse` in `./types.ts`.
        chunkedResponse: res.useChunkedEncodingByDefault,
    })))
    try {
        await deliver(res, record, method, answer)
    } finally {
        await runNodeEffect(answer.release)
    }
}

/**
 * What a request gets when answering it threw.
 *
 * Once the headers have gone out there is no status left to change, and there is
 * now a body to truncate: a `res.end()` here writes the terminating chunk of a
 * chunked response, so a body cut short by a throw arrives as a **clean, complete**
 * one — measured, `res.complete` `true` and no error raised. That is the same lie
 * {@link pumpBody} destroys for when a cell *fails*, reached by the other door, so
 * it destroys here too.
 *
 * What this keeps is the pre-headers case, where a status is still available and
 * `500` is the answer. `release` has already run by the time this is reached:
 * {@link answerRequest}'s `finally` is inside the `catch` that leads here.
 *
 * @type {(res: _ServerResponse) => void}
 */
const failSafe = res => {
    if (res.headersSent) {
        res.destroy()
        return
    }
    respondWith(res)(500)('internal server error')
}

const { mkdir, open, readFile, readdir, rename, writeFile, rm, access, stat } = fs.promises

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

/**
 * The flags a {@link Handle} is opened with — see the `open` handler for why the
 * second one is the operation rather than a detail of it. Windows has no
 * `O_NONBLOCK`, so the default leaves the open exactly as it was there.
 */
const { O_RDONLY, O_NONBLOCK = 0 } = fs.constants

const readFlags = O_RDONLY | O_NONBLOCK

/**
 * What a `Handle` holds here: the host's own open file. The same reach-through the
 * runner performs for a `Server` — a `Nominal` over `unknown` leaves what is inside
 * to whoever created it.
 *
 * @type {(handle: Handle) => FileHandle}
 */
const asFileHandle = handle => /** @type {FileHandle} */ (asBase(handle))

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
    rename: (src, dst) => io(() => rename(src, dst)),
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
            // **The accumulator is mutated**, for the reason
            // {@link collectBounded} gives above and on the condition it names:
            // rebuilding the array per window copies every chunk taken so far on
            // every chunk taken, which is quadratic in the *count*, and the array
            // never leaves this function before it is finished, so nothing
            // observes the mutation.
            //
            // What changed is whose count it is. This used to say the count was
            // small — a file is however many `Vec`s it takes, and `fjs/git`'s
            // packfiles and ref files are a handful of them — so §3.1 had no
            // exception to spend here. `fjs/web` serving an arbitrary file makes
            // the count the *caller's*, exactly as a request body's chunk count
            // is: a gigabyte is over eight thousand windows, and the rebuild
            // copies tens of millions of chunk references before the first byte
            // reaches a socket. A cap on one chunk is not a cap on their number.
            /** @type {Vec[]} */
            const chunks = []
            for (;;) {
                const chunk = await fill(fh, Buffer.alloc(maxFileSizeBytes), null)
                if (chunk.length !== 0) {
                    chunks.push(toVec(chunk))
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
            await fh.writeFile(fromVec(data))
        } catch (e) {
            failure = e
        }
        // Not in a `finally`: a failure to close must not replace the write's,
        // which is the one a caller can act on. If the close itself fails the
        // file is left behind, which is a stale lock on a filesystem already
        // failing — recorded in `fjs/git/todo/ref-writing.md`.
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
    // **The flag is the operation**, and without it the three that follow could
    // not be reached for the one entry they exist to refuse. A plain read-only
    // open of a FIFO with no writer never returns: measured on Darwin with Node
    // 26.8.1, it left the process unable to exit at all, holding its thread-pool
    // slot for as long as it lived — which is why every other read in `Fs` asks a
    // *name* whether it is a regular file and then opens whatever that name has
    // become. `O_NONBLOCK` answered at once for the same FIFO, and the `fstat`
    // below then said `isFile: false`, so the guard moves onto the descriptor and
    // the window between the two closes.
    //
    // A regular file is unaffected by the flag — measured, the same open read its
    // bytes — and Windows, which has no `O_NONBLOCK` and no FIFO an `open` reaches,
    // gets `0` and the open it always had.
    open: path => io(async () => /** @type {Handle} */ (asNominal(await open(path, readFlags)))),
    fstat: handle => io(async () => {
        const s = await asFileHandle(handle).stat()
        return { size: s.size, isFile: s.isFile(), isDirectory: s.isDirectory() }
    }),
    // `fill` rather than one `read`, for the reason it gives: one positional read
    // may answer less than it was asked for without the file being at its end, and
    // a caller counting bytes against a declared length would read that as a hole.
    pread: (handle, offset, size) => io(async () => {
        if (offset < 0) {
            throw new Error(`Offset ${offset} is negative`)
        }
        if (size > maxFileSizeBytes) {
            throw new Error(`Chunk size ${size} exceeds maximum allowed size of ${maxFileSizeBytes} bytes`)
        }
        return toVec(await fill(asFileHandle(handle), Buffer.alloc(size), offset))
    }),
    close: handle => io(() => asFileHandle(handle).close()),
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
        // Answering here rather than passing it on follows the `413` and `500`
        // above: the runner answers on the listener's behalf exactly when the
        // listener structurally cannot.
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
