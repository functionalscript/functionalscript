/**
 * Node.js effect operations: filesystem (`mkdir`, `readFile`, `readdir`,
 * `writeFile`, `rm`, `access`), networking (`fetch`, `createServer`, `listen`),
 * subprocess `exec`, console (`log`, `error`), `import_`, `now`, `sandbox`, `forever`,
 * and `all`/`both` parallelism; defines the `NodeOp`/`NodeProgram` types used
 * by the Node runner.
 *
 * @module
 */
import { utf8 } from '../../../text/module.f.ts'
import type { Vec } from '../../bit_vec/module.f.ts'
import type { Nominal } from '../../nominal/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import { encodeUtf8, toVec } from '../../uint8array/module.f.ts'
import {
    type Effect, type Func, type Operation, type ToAsyncOperationMap, do_
} from '../module.f.ts'

export type IoResult<T> = Result<T, unknown>

// all

export type All = ['all', <T>(...effects: Effect<never, T>[]) => readonly T[]]

const doAll: Func<All> = do_('all')

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulted `Effect`.
 *
 * @param a
 * @returns
 */
export const all =
    <O extends Operation, T>(...a: readonly Effect<O, T>[]): Effect<O | All, readonly T[]> =>
    doAll(...a as readonly Effect<never, T>[]) as Effect<O | All, readonly T[]>

export const both =
    <O0 extends Operation, T0>(a: Effect<O0, T0>) =>
    <O1 extends Operation, T1>(b: Effect<O1, T1>):
    Effect<O0 | O1 |All, readonly[T0, T1]> =>
    all<O0 | O1, T0 | T1>(a, b) as Effect<O0 | O1 | All, readonly[T0, T1]>

// fetch

export type Fetch = ['fetch', (url: string) => IoResult<Vec>]

export const fetch: Func<Fetch> = do_('fetch')

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type Mkdir = readonly['mkdir', (path: string, options?: MakeDirectoryOptions) => IoResult<void>]

export const mkdir: Func<Mkdir> =
    do_('mkdir')

// readFile

export type ReadFile = readonly['readFile', (path: string) => IoResult<Vec>]

export const readFile: Func<ReadFile> =
    do_('readFile')

// readdir

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
    readonly name: string
    readonly parentPath: string
    readonly isFile: boolean
}

export type ReaddirOptions = {
    readonly recursive?: true
}

export type Readdir = readonly['readdir', (path: string, options: ReaddirOptions) => IoResult<readonly Dirent[]>]

export const readdir: Func<Readdir> =
    do_('readdir')

// writeFile

export type WriteFile = readonly['writeFile', (path: string, data: Vec) => IoResult<void>]

export const writeFile: Func<WriteFile> =
    do_('writeFile')

// rm

export type Rm = readonly['rm', (path: string) => IoResult<void>]

export const rm: Func<Rm> =
    do_('rm')

// exec

export type ExecResult = {
    readonly stdout: string
    readonly stderr: string
}

export type Exec = readonly['exec', (command: string, stdin?: string) => IoResult<ExecResult>]

export const exec: Func<Exec> =
    do_('exec')

// access

export type Access = readonly['access', (path: string) => IoResult<void>]

export const access: Func<Access> =
    do_('access')

// Fs

export type Fs = Mkdir | ReadFile | Readdir | WriteFile | Rm | Exec | Access

// Server

export type Server =
    Nominal<'server', `160855c4f69310fece3273c1853ac32de43dee1eb41bf59d821917f8eebe9272`, unknown>

// createServer

export type Headers = {
    readonly [k in string]: string
}

export type IncomingMessage = {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    readonly body: Vec
}

export type ServerResponse = {
    readonly status: number
    readonly headers: Headers
    readonly body: Vec
}

export type RequestListener<O extends Operation> = (_: IncomingMessage) => Effect<O, ServerResponse>

export type CreateServer = ['createServer', (listener: RequestListener<Operation>) => Server]

export const createServer
    : <O extends Operation>(listener: RequestListener<O>) => Effect<O | CreateServer, Server> =
    do_<CreateServer>('createServer')

// listen

export type Listen = ['listen', (server: Server, port: number) => void]

export const listen: Func<Listen> =
    do_('listen')

// HTTP

export type Http = CreateServer | Listen

// Wait forever

export type Forever = ['forever', () => never]

export const forever: Func<Forever> =
    do_('forever')

// import

export type Module = {
    readonly default: unknown
}

export type Import = ['import', (path: string) => IoResult<Module>]

export const import_: Func<Import> = do_('import')

// write

export type WriteConsoles = 'stdout' | 'stderr'

export type Write = readonly['write', (stream: WriteConsoles, data: Vec) => void]

export const write: Func<Write> = do_('write')

const writeString = (stream: WriteConsoles) => (s: string): Effect<Write, void> =>
    write(stream, utf8(s + '\n'))

export const log = writeString('stdout')

export const error = writeString('stderr')

// now

export type Now = readonly['now', () => number]

export const now: Func<Now> = do_('now')

// sandbox

export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    /**
     * Measured milliseconds but it's not limited to that.
     * Instead, they represent times as floating-point numbers
     * with up to microsecond precision.
     */
    readonly duration: number
}

export type Sandbox = readonly['sandbox', <T>(f: () => T) => SandboxResult<T>]

/**
 * Runs a plain synchronous function in an isolated, measured environment.
 *
 * Combines try/catch and high-resolution timing into a single atomic operation.
 * Only plain synchronous functions are accepted — no effects, no promises.
 *
 * Using a single operation rather than separate `TryCatch` + `Perf` effects is
 * necessary for correctness: effects execute as async tasks, so the scheduler
 * can insert arbitrary work between two separate timing calls, making the
 * measured delta inaccurate. Here the clock reads happen synchronously around
 * the function call with nothing in between.
 *
 * Future parameters (time limit, memory limit) can be added to the payload
 * without breaking the API. Worker-based implementations can enforce hard
 * limits via worker termination.
 *
 * @see {@link SandboxResult}
 */
export const sandbox: Func<Sandbox> = do_('sandbox')

// Node

export type NodeOp =
    | All
    | Fetch
    | Fs
    | Http
    | Forever
    | Import
    | Now
    | Sandbox
    | Write

export type NodeEffect<T> = Effect<NodeOp, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOp>

/**
 * The environment variables.
 */
export type Env = {
    readonly [k: string]: string|undefined
}

export type NodeProgramOptions = {
    readonly args: readonly string[]
    readonly env: Env
    readonly std: { readonly [k in WriteConsoles]: { readonly isTTY: boolean } }
}

export type NodeProgram = (options: NodeProgramOptions) => Effect<NodeOp, number>
