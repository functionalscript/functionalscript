/**
 * Node.js effect runner: interprets `Effect<NodeOp, T>` directly against the
 * Node globals and built-in modules (`fs`, `http`, `child_process`, `process`,
 * `fetch`, …).
 *
 * There is deliberately no injectable IO seam here. Effectful programs are
 * tested against the in-memory interpreters in `fs/effects/mock` and
 * `fs/effects/node/virtual`, which interpret the same operations without
 * touching the OS, so a handler-table indirection in this module would have
 * exactly one instance and no consumer — the handlers reference the Node
 * globals directly instead.
 *
 * @module
 */
import http from 'node:http'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { once } from 'node:events'
import * as testContext from 'node:test'

import { concat } from '../../path/module.f.ts'
import { normalize } from '../../path/module.f.ts'
import { type Effect } from '../module.f.ts'
import { asyncRun } from '../module.ts'
import { memoryOperationMap } from './memory/module.ts'
import {
    type Server as EffectServer,
    type Headers,
    type IoResult,
    type Module,
    type NodeOp,
    type RequestListener as Erl,
    type NodeProgram,
    type NodeProgramOptions,
    type WriteConsoles,
    type TestContext,
    type TestFn,
} from './module.f.ts'
import { asBase, asNominal } from '../../types/nominal/module.f.ts'
import { error, ok, type Result } from '../../types/result/module.f.ts'
import { fromVec, listToVec, toVec } from '../../types/uint8array/module.f.ts'
import type { StringMap } from '../../types/object/module.f.ts'

type Server = {
    readonly listen: (port: number) => void
}

type Readable = AsyncIterable<Uint8Array>

type IncomingMessage = Readable & {
    readonly method: string
    readonly url: string
    readonly headers: Headers
}

type ServerResponse = {
    readonly writeHead: (status: number, headers: StringMap<string, string>) => ServerResponse
    readonly end: (body: Uint8Array) => void
}

type RequestListener = (req: IncomingMessage, res: ServerResponse) => Promise<void>

/**
 * Narrowed structural view of `node:http`'s `createServer`. The official types
 * declare `method`/`url` optional and header values as
 * `string | string[] | undefined`, while the effect-level `RequestListener`
 * requires them present; this local view keeps the narrowing in one place.
 */
const createServer: (listener: RequestListener) => Server = http.createServer

const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}

type EffectToPromise = <T>(effect: Effect<NodeOp, T>) => Promise<T>

const collect = async <T>(v: AsyncIterable<T>): Promise<readonly T[]> => {
    let result: readonly T[] = []
    for await (const a of v) {
        result = [...result, a]
    }
    return result
}

const { mkdir, readFile, readdir, writeFile, rm, access } = fs.promises

const { exec } = childProcess

const prefix = 'file:///' as const

const asyncImport = (v: string): Promise<Module> => {
    const s0 = v.includes(':') || v.startsWith('/') ? v : concat(process.cwd())(v)
    const s1 = s0.startsWith(prefix) ? s0 : `${prefix}${s0}`
    return import(s1)
}

const sandbox = async <T>(f: () => T) => {
    let result: Result<T, unknown>
    let after: number
    const before = performance.now()
    try {
        let p = f()
        after = performance.now()
        if (p instanceof Promise) {
            p = await p
            after = performance.now()
        }
        result = ok(p as T)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
}

const awaitPromise = async (p: unknown): Promise<readonly[unknown]> =>
    [p instanceof Promise ? await p : p]

const { now } = Date

/** Maps `WriteConsoles` names to the corresponding Node.js writable streams. */
const streams: { readonly [k in WriteConsoles]: NodeJS.WritableStream } = {
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
 */
const writeAll = async (stream: NodeJS.WritableStream, data: Uint8Array): Promise<void> => {
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
 */
const waitReadableOrEnd = (stdin: NodeJS.ReadStream): Promise<boolean> =>
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
 */
const readStdinByte = async (): Promise<number | null> => {
    const stdin = process.stdin
    while (true) {
        const chunk = stdin.read(1) as Uint8Array | null
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

const runNodeEffect: EffectToPromise = asyncRun({
    ...memoryOperationMap(),
    all: async (...effects) => await Promise.all(effects.map(runNodeEffect)),
    fetch: async url => tc(async() => {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Fetch error: ${response.status} ${response.statusText}`)
        }
        return toVec(new Uint8Array(await response.arrayBuffer()))
    }),
    mkdir: (...p) => tc(async() => { await mkdir(...p) }),
    readFile: path => tc(async() => toVec(await readFile(path))),
    readdir: (path, r) => tc(async() =>
        (await readdir(path, { ...r, withFileTypes: true }))
        .map(v => ({
            name: v.name,
            parentPath: normalize(v.parentPath),
            isFile: v.isFile()
        }))
    ),
    writeFile: (path, data) => tc(() => writeFile(path, fromVec(data))),
    rm: path => tc(() => rm(path)),
    access: path => tc(() => access(path)),
    import: path => tc(() => asyncImport(path)),
    exec: (command, stdin) => new Promise(resolve => {
        const child = exec(command, (e, stdout, stderr) =>
            resolve(e !== null ? ['error', e] as const : ok({ stdout, stderr }))
        )
        child.stdin?.end(stdin)
    }),
    createServer: async requestListener => {
        const erl = requestListener as Erl<NodeOp>
        const nodeRl: RequestListener = async(req, res) => {
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
        const server: EffectServer = asNominal(createServer(nodeRl))
        return server
    },
    listen: async (server, port) => {
        const s = asBase(server) as Server
        s.listen(port)
    },
    forever: () => new Promise(() => {}),
    now: async () => now(),
    sandbox,
    await: awaitPromise,
    write: (stream, data) => writeAll(streams[stream], fromVec(data)),
    read: readStdinByte,
    test: async (ctx, name, expectFailure, test) =>
        ctx.test(name, { expectFailure }, async t => runNodeEffect(test(t))),
})

const isPlaywright = 'PLAYWRIGHT_TEST' in (process?.env ?? {})

const pwTest = isPlaywright
    ? (await import('@playwright/test') as any).test
    : undefined

const inlineTest: TestFn = async (name, { expectFailure }, fn) => {
    if (expectFailure) {
        try { await fn(inlineContext) } catch { return }
        throw new Error(`expected to throw: ${name}`)
    } else {
        await fn(inlineContext)
    }
}

const inlineContext: TestContext = { test: inlineTest }

type FrameworkRegister = (name: string, fn: () => Promise<void>) => Promise<void>

const wrapInlineTest = (register: FrameworkRegister): TestContext => ({
    test: (name, opts, fn) => register(name, () => inlineTest(name, opts, fn))
})

const bunTestContext = wrapInlineTest(testContext.test)
const playwrightTestContext = wrapInlineTest(pwTest!)

const options: NodeProgramOptions = {
    args: process.argv.slice(2),
    env: process.env,
    home: os.homedir().replaceAll('\\', '/'),
    std: { stdout: process.stdout, stderr: process.stderr },
    testContext,
    bunTestContext,
    playwrightTestContext,
    engine: isPlaywright ? 'playwright' : 'Bun' in globalThis ? 'bun' : 'node',
}

/**
 * Runs a `NodeProgram` against the real Node globals and process arguments,
 * resolving to its exit code **without** terminating the process.
 *
 * Use this when the caller must stay alive afterwards — e.g. when proofs are
 * registered under an external test runner (Node `--test`, Bun, Playwright)
 * that owns the process lifecycle. For a standalone CLI entry point that should
 * exit with the program's code, use {@link run} instead.
 */
export const runEffect: (p: NodeProgram) => Promise<number> = program =>
    runNodeEffect(program(options))

/**
 * CLI entry point: runs a `NodeProgram` via {@link runEffect}, then calls
 * `process.exit` with its exit code. The `Promise<never>` return type reflects
 * that control never returns to the caller — the process terminates.
 *
 * A `bin` script can simply
 * `import { run } from '.../fs/effects/node/module.js'; await run(main)`.
 */
export const run: (p: NodeProgram) => Promise<never> = async p =>
    process.exit(await runEffect(p))
