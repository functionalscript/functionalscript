import type { BufferEncoding, Io } from './module.f.ts'
import { at, type Map } from '../types/map/module.f.ts'

export const createVirtualIo = (files: Map<string>): Io => ({
    console: {
        log: (..._d: unknown[]) => {}
    },
    fs: {
        writeFileSync: (_file: string, _data: string) => { },
        readFileSync: (path: string, _options: BufferEncoding) => { return at(path)(files) }
    },
    args: []
})