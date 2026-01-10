import type { Io, MakeDirectoryOptions, ReadFile, RmOptions } from '../module.f.ts'
import { at, type OrderedMap } from '../../types/ordered_map/module.f.ts'

export const createVirtualIo = (files: OrderedMap<string>): Io => ({
    console: {
        log: (..._d: unknown[]) => {},
        error: (..._d: unknown[]) => {}
    },
    fs: {
        writeSync: (fd:number, s: string) => {},
        writeFileSync: (_file: string, _data: string) => { },
        readFileSync: (path: string) => { return at(path)(files) },
        existsSync: (path: string) => { return at(path)(files) !== null },
        promises: {
            readdir: async(_path: string) => [],
            readFile: async(_path: string) => new Uint8Array(),
            writeFile: async(_path: string, _data: string) => {},
            rm: async(_path: string, _options?: RmOptions) => {},
            mkdir: async(_path: string, _options?: MakeDirectoryOptions) => undefined,
            copyFile: async(_src: string, _dest: string) => {},
        }
    },
    process: {
        argv: [],
        env: {},
        exit: n => { throw n },
        cwd: () => '',
        stdout: { fd: 1, isTTY: false },
        stderr: { fd: 2, isTTY: false },
    },
    asyncImport: () => Promise.reject(),
    performance: {
        now: () => 0,
    },
    fetch: () => Promise.reject(),
    tryCatch: f => ['ok', f()],
    asyncTryCatch: async f => ['ok', await f()],
})
