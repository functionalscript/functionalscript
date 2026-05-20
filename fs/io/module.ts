import http from 'node:http'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import process from 'node:process'
import { fromIo, type Io, type Run, run } from './module.f.ts'
import { concat } from '../path/module.f.ts'
import type { Module, NodeProgram, SandboxResult } from '../types/effects/node/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'

const prefix = 'file:///'

const { now: perfNow } = performance

const { now } = Date

export const asyncImport = (v: string): Promise<Module> => import(v)

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
    tryCatch: f => {
        try {
            return ok(f())
        } catch (e) {
            return error(e)
        }
    },
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
        let duration = 0
        try {
            let value: T
            let before = 0
            try {
                before = perfNow()
                value = f()
            } finally {
                const after = perfNow()
                duration = after - before
            }
            result = ok(value)
        } catch (e) {
            result = error(e)
        }
        return { result, duration }
    },
}

export const legacyRun: Run = run(io)

export type NodeRun = (p: NodeProgram) => Promise<number>

export const ioRun = (io: Io): NodeRun => {
    const r = fromIo(io)
    const { argv, env } = io.process
    return p => r(p(argv, env))
}

const effectRun: NodeRun = ioRun(io)

export default effectRun
