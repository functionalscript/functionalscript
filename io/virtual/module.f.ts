import type { BufferEncoding, Io, MakeDirectoryOptions, ReadFile, RmOptions } from '../module.f.ts'
import { at, type OrderedMap } from '../../types/ordered_map/module.f.ts'

export const createVirtualIo = (files: OrderedMap<string>): Io => ({
    console: {
        log: (..._d: unknown[]) => {},
        error: (..._d: unknown[]) => {}
    },
    fs: {
        writeSync: (fd:number, s: string) => {},
        writeFileSync: (_file: string, _data: string) => { },
        readFileSync: (path: string, _options: BufferEncoding) => { return at(path)(files) },
        existsSync: (path: string) => { return at(path)(files) !== null },
        promises: {
            readdir: (_path: string) => Promise.resolve([]),
            readFile: ((_path: string, _options?: BufferEncoding) => _options === undefined ? Promise.resolve(new Uint8Array()) : Promise.resolve('')) as ReadFile,
            writeFile: (_path: string, _data: string, _options: BufferEncoding) => Promise.resolve(),
            rm: (_path: string, _options?: RmOptions) => Promise.resolve(),
            mkdir: (_path: string, _options?: MakeDirectoryOptions) => Promise.resolve(undefined),
            copyFile: (_src: string, _dest: string) => Promise.resolve(),
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
