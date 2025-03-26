import type { Io } from './module.f.ts'
import fs from 'node:fs'
import process from "node:process"

export default {
    console,
    fs,
    process,
    asyncImport: v => import(v),
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
} satisfies Io
