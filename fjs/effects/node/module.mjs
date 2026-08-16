/**
 * Node.js effect runner: interprets `Effect<NodeOp, T>` directly against the
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
 * @import { IoResult, Server as EffectServer, Headers, Module, NodeOp, RequestListener as Erl, NodeProgram, NodeProgramOptions, WriteConsoles, TestContext, TestFn, } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
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
import { toIoError, usesInlineTestContext } from './module.f.mjs'
import { asBase, asNominal } from '../../types/nominal/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { asyncTryCatch } from '../../types/result/module.mjs'
import { fromVec, listToVec, toVec } from '../../types/uint8array/module.f.mjs'
import { maxLengthBytes } from '../../types/bit_vec/module.f.mjs'

/** @typedef {{ readonly listen: (port: number) => void }} _Server */

/** @typedef {AsyncIterable<Uint8Array>} _Readable */

/**
 * @typedef {_Readable & {
 *   readonly method: string,
 *   readonly url: string,
 *   readonly headers: Headers,
 * }} _IncomingMessage
 */

/**
 * @typedef {{
 *   readonly writeHead: (status: number, headers: StringMap<string>) => _ServerResponse,
 *   readonly end: (body: Uint8Array) => void,
 * }} _ServerResponse
 */

/** @typedef {(req: _IncomingMessage, res: _ServerResponse) => Promise<void>} _RequestListener */

/**
 * Narrowed structural view of `node:http`'s `createServer`. The official types
 * declare `method`/`url` optional and header values as
 * `string | string[] | undefined`, while the effect-level `_RequestListener`
 * requires them present; this local view keeps the narrowing in one place.
 * @type {(listener: _RequestListener) => _Server}
 */
const createServer = http.createServer

/** @typedef {<T>(effect: Effect<NodeOp, T>) => Promise<T>} _EffectToPromise */

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
 * @template T
 * @param {AsyncIterable<T>} v
 * @returns {Promise<readonly T[]>}
 */
const collect = async v => {
    /** @type {readonly T[]} */
    let result = []
    for await (const a of v) {
        result = [...result, a]
    }
    return result
}

const { mkdir, open, readFile, readdir, rename, writeFile, rm, access, stat } = fs.promises

const { exec } = childProcess

const maxFileSizeBytes = Number(maxLengthBytes)

const prefix = /** @type {const} */ ('file:///')

/** @type {(v: string) => Promise<Module>} */
const asyncImport = v => {
    const s0 = v.includes(':') || v.startsWith('/') ? v : concat(process.cwd())(v)
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

/** @type {_EffectToPromise} */
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
    stat: path => io(async () => ({ size: (await stat(path)).size })),
    import: path => io(() => asyncImport(path)),
    exec: (command, stdin) => new Promise(resolve => {
        const child = exec(command, (e, stdout, stderr) =>
            resolve(e !== null ? error(toIoError(e)) : ok({ stdout, stderr }))
        )
        child.stdin?.end(stdin)
    }),
    createServer: async requestListener => {
        const erl = /** @type {Erl<NodeOp>} */ (requestListener)
        /** @type {_RequestListener} */
        const nodeRl = async (req, res) => {
            const reqBody = await collect(req)
            const { method, url, headers } = req
            const { status, headers: outHeaders, body: outBody } = await runNodeEffect(erl({
                method,
                url,
                headers,
                body: listToVec(reqBody)
            }))
            res
                .writeHead(status, outHeaders)
                .end(fromVec(outBody))
        }
        return ok(/** @satisfies {EffectServer} */ (asNominal(createServer(nodeRl))))
    },
    listen: async (server, port) => {
        const s = /** @type {_Server} */ (asBase(server))
        s.listen(port)
        return ok(undefined)
    },
    forever: () => new Promise(() => {}),
    now: async () => ok(now()),
    sandbox: async f => ok(await sandbox(f)),
    await: async p => ok(await awaitPromise(p)),
    write: async (stream, data) => ok(await writeAll(streams[stream], fromVec(data))),
    read: async () => ok(await readStdinByte()),
    test: async (ctx, name, expectFailure, test) =>
        ok(await ctx.test(name, { expectFailure }, async t => runNodeEffect(test(t)))),
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

/** @typedef {(name: string, fn: () => Promise<void>) => Promise<void>} _FrameworkRegister */

/** @type {(register: _FrameworkRegister) => TestContext} */
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
export const runEffect = program =>
    runNodeEffect(program(options))

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
