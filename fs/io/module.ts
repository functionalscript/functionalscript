import http from 'node:http'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'
import { concat } from '../path/module.f.ts'
import { once } from 'node:events'
import { fromIo, type Io, runProgram } from './module.f.ts'
import type { Module, NodeProgram, WriteConsoles } from '../types/effects/node/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'
import { fromVec } from '../types/uint8array/module.f.ts'
import * as testContext from 'node:test'

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
    sandbox: <T>(f: () => T) => {
        let result: Result<T, unknown>
        let after: number
        const before = performance.now()
        try {
            const value = f()
            after = performance.now()
            result = ok(value)
        } catch (e) {
            after = performance.now()
            result = error(e)
        }
        return { result, duration: after - before }
    },
    write: (stream, data) => writeAll(streams[stream], fromVec(data)),
    testContext,
    engine: 'Bun' in globalThis ? 'bun' : 'node',
}
export type NodeRun = (p: NodeProgram) => Promise<number>

const effectRun: NodeRun =
    runProgram(io)(io.process.argv.slice(2))

export default effectRun
