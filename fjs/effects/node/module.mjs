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
 * @import { _Readable, _RequestListener, _Server, _ServerResponse } from './private.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import http from 'node:http'
import childProcess from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { once } from 'node:events'
import * as testContext from 'node:test'

import { concat, normalize, toPosix } from '../../path/module.f.mjs'
import { asyncRun } from '../module.mjs'
import { memoryOperationMap } from './memory/module.mjs'
import {
    emptyHost, emptyHostCode, emptyHostMessage, exitCode, toIoError, usesInlineTestContext,
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
 * The runner's own answer, for the cases a listener never gets to give one: a
 * request body too large to hand it, and a listener that threw.
 *
 * **It closes the connection**, which is the whole difference between refusing
 * a request and surviving the refusal. Both cases answer without having read
 * the request to its end, and on a keep-alive connection Node then waits for
 * the rest of a body that is never coming — the socket is stuck, and the next
 * request on it is never answered. A client that declares ten megabytes and
 * sends a hundred kilobytes could hold connections open that way for as long as
 * it liked. Draining the remainder would be the polite alternative and the
 * wrong one: it reads bytes this server has already decided it will not use.
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
 * A body past the cap never reaches the listener: `IncomingMessage.body` is a
 * single `Vec`, so there is no request value to build, and `413` is the accurate
 * answer rather than a truncated one. Streaming bodies lift the whole limit —
 * see `./todo/streaming-http-bodies.md`.
 *
 * `unwrap` is total here: a `RequestListener` answers
 * `Effect<…, ServerResponse, never>`, because the response frame *is* where a
 * listener puts its failures.
 *
 * @type {(listener: Erl<NodeOp>) => _RequestListener}
 */
const answerRequest = listener => async (req, res) => {
    const body = await collectBounded(req)
    if (body === null) {
        respondWith(res)(413)('request body too large')
        return
    }
    const { method, url, headers } = req
    const { status, headers: outHeaders, body: outBody } = unwrap(await runNodeEffect(listener({
        method,
        url,
        headers,
        body: listToVec(body),
    })))
    res.writeHead(status, outHeaders).end(fromVec(outBody))
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

/**
 * @template T
 * @param {() => T} f
 * @returns {Promise<{ readonly result: Result<T, unknown>, readonly duration: number }>}
 */
const sandbox = async f => {
    /** @type {Result<T, unknown>} */
    let result
    let after
    const before = performance.now()
    try {
        let p = f()
        after = performance.now()
        if (p instanceof Promise) {
            p = await p
            after = performance.now()
        }
        result = ok(p)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
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
    readFile: path => io(async () => {
        const fileStats = await stat(path)
        // if the file is too big, toVec should fail anyway but in this case we don't want to load the file.
        if (fileStats.size > maxFileSizeBytes) {
            throw new Error(`File size ${fileStats.size} exceeds maximum allowed size of ${Number(maxFileSizeBytes)} bytes`)
        }
        return toVec(await readFile(path))
    }),
    readdir: (path, r) => io(async () =>
        (await readdir(path, { ...r, withFileTypes: true }))
        .map(v => ({
            name: v.name,
            parentPath: normalize(v.parentPath),
            isFile: v.isFile()
        }))
    ),
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
        const fh = await open(path, 'r')
        try {
            const buffer = Buffer.alloc(size)
            const { bytesRead } = await fh.read(buffer, 0, size, offset)
            return toVec(buffer.subarray(0, bytesRead))
        } finally {
            await fh.close()
        }
    }),
    randomInt: async () => ok(randomInt(randomMax)),
    access: path => io(() => access(path)),
    createExclusive: path => io(async () => {
        const fh = await open(path, 'wx')
        await fh.close()
    }),
    writeBytes: (path, offset, data) => io(async () => {
        const fh = await open(path, 'r+')
        try {
            const buffer = fromVec(data)
            // Loop over short writes so the whole Vec lands — a partial pwrite would
            // leave a hole the publish-time size check could pass over.
            let written = 0
            while (written < buffer.length) {
                const { bytesWritten } = await fh.write(buffer, written, buffer.length - written, offset + written)
                written += bytesWritten
            }
        } finally {
            await fh.close()
        }
    }),
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
    sandbox: async f => ok(await sandbox(f)),
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
