import { type Io, type Module, type Run, run } from './module.f.ts'
import fs from 'node:fs'
import process from "node:process"
import { concat } from '../path/module.f.ts'

export const io: Io = {
    console,
    fs,
    process,
    asyncImport: (v: string): Promise<Module> => {
        const x = `file://${concat(process.cwd())(v)}`
        console.log('import', x)
        return import(x)
    },
    performance,
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
