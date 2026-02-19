import { fromIo, type Io, type Module, type Run, run } from './module.f.ts'
import fs from 'node:fs'
import process from "node:process"
import { concat } from '../path/module.f.ts'
import type { NodeProgram } from '../types/effect/node/module.f.ts'

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
            return ['ok', f()]
        } catch (e) {
            return ['error', e]
        }
    },
    asyncTryCatch: async f => {
        try {
            return ['ok', await f()]
        } catch (e) {
            return ['error', e]
        }
    },
}

const runDefault: Run = run(io)

export default runDefault

export type NodeRun = (p: NodeProgram) => Promise<number>

export const ioRun = (io: Io): NodeRun => {
    const r = fromIo(io)
    const { argv } = io.process
    return p => r(p(argv))
}

export const nodeRun: NodeRun = ioRun(io)
