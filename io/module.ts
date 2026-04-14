import http from 'node:http'
import { exec } from 'node:child_process'
import { fromIo, type Io, type Module, type Run, run } from './module.f.ts'
import fs from 'node:fs'
import process from 'node:process'
import { concat } from '../path/module.f.ts'
import type { NodeProgram } from '../types/effects/node/module.f.ts'
import { error, ok } from '../types/result/module.f.ts'

const prefix = 'file:///'

export const io: Io = {
    console,
    fs,
    process,
    asyncImport: (v: string): Promise<Module> => {
        const s0 = v.includes(':') || v.startsWith('/') ? v : concat(process.cwd())(v)
        const s1 = s0.startsWith(prefix) ? s0 : `${prefix}${s0}`
        return import(s1)
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
    childProcess: {
        exec: ([command, stdin]) => new Promise(resolve => {
            const child = exec(command, (e: Error | null, stdout: string, stderr: string) =>
                resolve(e !== null ? error(e) : ok({ stdout, stderr }))
            )
            if (stdin !== undefined && child.stdin !== null) {
                child.stdin.end(stdin)
            }
        }),
    },
}

export const legacyRun: Run = run(io)

export type NodeRun = (p: NodeProgram) => Promise<number>

export const ioRun = (io: Io): NodeRun => {
    const r = fromIo(io)
    const { argv } = io.process
    return p => r(p(argv))
}

const effectRun: NodeRun = ioRun(io)

export default effectRun
