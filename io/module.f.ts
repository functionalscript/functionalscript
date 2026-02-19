import { normalize } from '../path/module.f.ts'
import { asyncRun } from '../types/effect/module.ts'
import type { IoResult, NodeEffect } from '../types/effect/node/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'
import { fromVec, toVec } from '../types/uint8array/module.f.ts'

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
    readonly name: string
    readonly isDirectory: () => boolean
    readonly isFile: () => boolean
}

export type RmOptions = {
    readonly force?: boolean
    readonly recursive?: boolean
}

export type MakeDirectoryOptions = {
    readonly recursive?: boolean
}

export type ReadDir =
    & ((path: string, options: { withFileTypes: true }) => Promise<Dirent[]>)
    & ((path: string, options: { recursive?: true }) => Promise<readonly string[]>)

/**
 * File system operations interface
 * @see https://nodejs.org/api/fs.html
 */
export type Fs = {
    readonly writeSync: (fd:number, s: string) => void
    readonly writeFileSync: (file: string, data: Uint8Array) => void
    readonly readFileSync: (path: string) => Uint8Array | null
    readonly existsSync: (path: string) => boolean
    readonly promises: {
        readonly readFile: (path: string) => Promise<Uint8Array>
        readonly writeFile: (path: string, data: Uint8Array) => Promise<void>
        readonly readdir: ReadDir
        readonly rm: (path: string, options?: RmOptions) => Promise<void>
        readonly mkdir: (path: string, options?: MakeDirectoryOptions) => Promise<string|undefined>
        readonly copyFile: (src: string, dest: string) => Promise<void>
    }
}

/**
 * Console operations interface
 * @see https://nodejs.org/api/console.html
 */
export type Console = {
    readonly log: (...d: unknown[]) => void,
    readonly error: (...d: unknown[]) => void
}

/**
 * Represents an ES module with a default export
 */
export type Module = {
    readonly default: unknown
}

/**
 * High-resolution time measurement interface
 * @see https://nodejs.org/api/perf_hooks.html#performance-now
 */
export type Performance = {
    readonly now: () => number
}

export type Writable = {
    readonly fd: number
    readonly isTTY: boolean
}

/**
 * Node.js Process interface
 * @see https://nodejs.org/api/process.html
 */
export type Process = {
    readonly argv: string[]
    readonly env: Env
    readonly exit: (code: number) => never
    readonly cwd: () => string
    readonly stdout: Writable
    readonly stderr: Writable
}

export type TryCatch = <T>(f: () => T) => Result<T, unknown>

/**
 * Core IO operations interface providing access to system resources
 */
export type Io = {
    readonly console: Console,
    readonly fs: Fs,
    readonly process: Process
    readonly asyncImport: (s: string) => Promise<Module>
    readonly performance: Performance
    readonly fetch: (url: string) => Promise<Response>
    readonly tryCatch: TryCatch
    readonly asyncTryCatch: <T>(f: () => Promise<T>) => Promise<Result<T, unknown>>
}

/**
 * The environment variables.
 */
export type Env = {
    readonly [k: string]: string|undefined
}

export type App = (io: Io) => Promise<number>

export type Run = (f: App) => Promise<never>

/**
 * Runs a function and exits the process with the returned code
 * Handles errors by exiting with code 1
 */
export const run = (io: Io): Run => {
    const code = ([x, b]: Result<number, unknown>) => {
        if (x === 'error') {
            io.console.error(b)
            return 1
        } else {
            return b
        }
    }
    return async f => io.process.exit(code(await io.asyncTryCatch(() => f(io))))
}

const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}

export const fromIo = ({
    console: { error, log },
    fs: { promises: { mkdir, readFile, readdir, writeFile } },
}: Io): <T>(effect: NodeEffect<T>) => Promise<T> =>
asyncRun({
    error: async message => error(message),
    log: async message => log(message),
    mkdir: param => tc(async() => { await mkdir(...param) }),
    readFile: path => tc(async() => toVec(await readFile(path))),
    readdir: ([path, r]) => tc(async() =>
        (await readdir(path, { ...r, withFileTypes: true }))
        .map(v => ({ name: normalize(v.name), isFile: v.isFile() }))
    ),
    writeFile: ([path, data]) => tc(() => writeFile(path, fromVec(data))),
})
