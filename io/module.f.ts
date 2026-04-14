import { normalize } from '../path/module.f.ts'
import { type Effect } from '../types/effects/module.f.ts'
import { asyncRun } from '../types/effects/module.ts'
import type { ExecParam, ExecResult, Server as EffectServer, Headers, IoResult, NodeOp, RequestListener as Erl } from '../types/effects/node/module.f.ts'
import { asBase, asNominal } from '../types/nominal/module.f.ts'
import { error, ok, type Result } from '../types/result/module.f.ts'
import { fromVec, listToVec, toVec } from '../types/uint8array/module.f.ts'

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
    readonly name: string
    readonly parentPath: string
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

export type Server = {
    readonly listen: (port: number) => void
}

export type Readable = AsyncIterable<Uint8Array>

export type IncomingMessage = Readable & {
    readonly method: string
    readonly url: string
    readonly headers: Headers
}

export type ServerResponse = {
    readonly writeHead: (status: number, headers: Record<string, string>) => ServerResponse
    readonly end: (body: Uint8Array) => void
}

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => Promise<void>

export type Http = {
    readonly createServer: (_: RequestListener) => Server
}

export type ChildProcess = {
    readonly exec: (param: ExecParam) => Promise<IoResult<ExecResult>>
}

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
    readonly http: Http
    readonly childProcess: ChildProcess
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
    const exitCode = ([x, b]: Result<number, unknown>) => {
        if (x === 'error') {
            io.console.error(b)
            return 1
        } else {
            return b
        }
    }
    return async f => io.process.exit(exitCode(await io.asyncTryCatch(() => f(io))))
}

const tc = async<T>(f: () => Promise<T>): Promise<IoResult<T>> => {
    try {
        return ok(await f())
    } catch (e) {
        return error(e)
    }
}

export type EffectToPromise = <T>(effect: Effect<NodeOp, T>) => Promise<T>

const collect = async <T>(v: AsyncIterable<T>): Promise<readonly T[]> => {
    let result: readonly T[] = []
    for await (const a of v) {
        result = [...result, a]
    }
    return result
}

export const fromIo = ({
    console: { error, log },
    fs: { promises: { mkdir, readFile, readdir, writeFile, rm } },
    fetch,
    http: { createServer },
    childProcess: { exec },
}: Io): EffectToPromise => {
    const result: EffectToPromise = asyncRun({
        all: async effects => await Promise.all(effects.map(result)),
        error: async message => error(message),
        log: async message => log(message),
        fetch: async url => tc(async() => {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Fetch error: ${response.status} ${response.statusText}`)
            }
            return toVec(new Uint8Array(await response.arrayBuffer()))
        }),
        mkdir: param => tc(async() => { await mkdir(...param) }),
        readFile: path => tc(async() => toVec(await readFile(path))),
        readdir: ([path, r]) => tc(async() =>
            (await readdir(path, { ...r, withFileTypes: true }))
            .map(v => ({ name: v.name, parentPath: normalize(v.parentPath), isFile: v.isFile() }))
        ),
        writeFile: ([path, data]) => tc(() => writeFile(path, fromVec(data))),
        rm: path => tc(() => rm(path)),
        exec,
        createServer: async requestListener => {
            const erl = requestListener as Erl<NodeOp>
            const nodeRl: RequestListener = async(req, res) => {
                const reqBody = await collect(req)
                const { method, url, headers } = req
                const { status, headers: outHeaders, body: outBody } = await result(erl({
                    method,
                    url,
                    headers,
                    body: listToVec(reqBody)
                }))
                res
                    .writeHead(status, outHeaders)
                    .end(fromVec(outBody))
            }
            const server: EffectServer = asNominal(createServer(nodeRl))
            return server
        },
        listen: async ([server, port]) => {
            const s = asBase(server) as Server
            s.listen(port)
        },
        forever: () => new Promise(() => {})
    })
    return result
}
