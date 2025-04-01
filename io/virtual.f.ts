import type { BufferEncoding, Io } from './module.f.ts'
import { at, type Map } from '../types/stringMap/module.f.ts'

export const createVirtualIo = (files: Map<string>): Io => ({
    console: {
        log: (..._d: unknown[]) => {},
        error: (..._d: unknown[]) => {}
    },
    fs: {
        writeFileSync: (_file: string, _data: string) => { },
        readFileSync: (path: string, _options: BufferEncoding) => { return at(path)(files) },
        existsSync: (path: string) => { return at(path)(files) !== null },
        promises: {
            readdir: (_path: string) => Promise.resolve([]),
            readFile: (_path: string, _options: BufferEncoding) => Promise.resolve(''),
            writeFile: (_path: string, _data: string, _options: BufferEncoding) => Promise.resolve(),
        }
    },
    process: {
        argv: [],
        env: {},
        exit: n => { throw n },
    },
    asyncImport: () => Promise.reject(),
    performance: {
        now: () => 0,
    },
    tryCatch: f => ['ok', f()],
    asyncTryCatch: async f => ['ok', await f()],
})
