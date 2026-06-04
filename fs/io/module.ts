import http from 'node:http'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'
import { concat } from '../path/module.f.ts'
import { once } from 'node:events'
import { type Io, runProgram } from './module.f.ts'
import type { Module, NodeProgram, WriteConsoles } from '../types/effects/node/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'
import { fromVec } from '../types/uint8array/module.f.ts'
import * as testContext from 'node:test'
import type { TestContext, TestFn } from '../types/effects/node/module.f.ts'

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

const bunTestContext        = wrapInlineTest(testContext.test)
const playwrightTestContext = wrapInlineTest(pwTest!)

const prefix = 'file:///'

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

export const asyncImport = (v: string): Promise<Module> => import(v)

export const tryCatch: <T>(f: () => T) => Result<T, unknown> = f => {
    try {
        return ok(f())
    } catch (e) {
        return error(e)
    }
}

const awaitPromise = async (p: unknown): Promise<readonly[unknown]> =>
    [p instanceof Promise ? await p : p]

export const io: Io = {
    console,
    fs,
    process,
    asyncImport: (v: string): Promise<Module> => {
        const s0 = v.includes(':') || v.startsWith('/') ? v : concat(process.cwd())(v)
        const s1 = s0.startsWith(prefix) ? s0 : `${prefix}${s0}`
        return asyncImport(s1)
    },
    performance,
    fetch,
    tryCatch,
    asyncTryCatch: async f => {
        try {
            return ok(await f())
        } catch (e) {
            return error(e)
        }
    },
    http,
    childProcess,
    now,
    sandbox: async <T>(f: () => T) => {
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
    },
    write: (stream, data) => writeAll(streams[stream], fromVec(data)),
    await: awaitPromise,
    testContext,
    bunTestContext,
    playwrightTestContext,
    engine: isPlaywright ? 'playwright' : 'Bun' in globalThis ? 'bun' : 'node',
}

export type NodeRun = (p: NodeProgram) => Promise<never>

/**
 * Runs a `NodeProgram` against the real Node `io` and process arguments,
 * resolving to its exit code **without** terminating the process.
 *
 * Use this when the caller must stay alive afterwards — e.g. when proofs are
 * registered under an external test runner (Node `--test`, Bun, Playwright)
 * that owns the process lifecycle. For a standalone CLI entry point that should
 * exit with the program's code, use the default {@link run} export instead.
 */
export const runEffect: (p: NodeProgram) => Promise<number> =
    runProgram(io)(io.process.argv.slice(2))

/**
 * CLI entry point: runs a `NodeProgram` via {@link runEffect}, then calls
 * `process.exit` with its exit code. The `Promise<never>` return type reflects
 * that control never returns to the caller — the process terminates.
 *
 * This is the default export so a `bin` script can simply
 * `import run from '.../io/module.js'; run(main)`.
 */
const run: NodeRun = async p =>
    process.exit(await runEffect(p))

export default run
