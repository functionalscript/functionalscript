import type { BufferEncoding, Io, MakeDirectoryOptions, RmOptions } from './module.f.ts'
import { at, type Map } from '../types/map/module.f.ts'

export const createVirtualIo = (files: Map<string>): Io => ({
    console: {
        log: (...d: unknown[]) => {}
    },
    fs: {
        promises: {
            readdir: (_: string) => { return new Promise((resolve, reject) => { resolve([]) }) },
            rm: (path: string, options?: RmOptions) => { return new Promise((resolve, reject) => { resolve() }) },
            mkdir: (path: string, options?: MakeDirectoryOptions) => { return new Promise((resolve, reject) => { resolve(undefined) }) },
            copyFile: (src: string, dest: string) => { return new Promise((resolve, reject) => { resolve() }) },
            writeFile: (file: string, data: string) => { return new Promise((resolve, reject) => { resolve() }) },
            readFile: (path: string, options: BufferEncoding) => { return new Promise((resolve, reject) => {
                 const result = at(path)(files)
                 if (result === null)
                 {
                    reject()
                    return
                 }
                 resolve(result)
            }) },
        }
    }
})