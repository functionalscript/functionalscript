import type { Vec } from '../../bit_vec/module.f.ts'
import type { Nominal } from '../../nominal/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import {
    type Effect, type Func, type Operation, type RestFunc, type ToAsyncOperationMap, doRest, do_
} from '../module.f.ts'

export type IoResult<T> = Result<T, unknown>

// all

export type All = ['all', <T>(_: readonly Effect<never, T>[]) => readonly T[]]

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulted `Effect`.
 *
 * @param a
 * @returns
 */
export const all =
    <O extends Operation, T>(...a: readonly Effect<O, T>[]): Effect<O | All, readonly T[]> =>
    do_<All>('all')(a as readonly Effect<never, T>[]) as Effect<O | All, readonly T[]>

export const both =
    <O0 extends Operation, T0>(a: Effect<O0, T0>) =>
    <O1 extends Operation, T1>(b: Effect<O1, T1>):
    Effect<O0 | O1 |All, readonly[T0, T1]> =>
    all<O0|O1, T0|T1>(a, b) as Effect<O0 | O1 | All, readonly[T0, T1]>

// fetch

export type Fetch = ['fetch', (_: string) => IoResult<Vec>]

export const fetch: Func<Fetch> = do_('fetch')

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type MkdirParam = readonly[string, MakeDirectoryOptions?]

export type Mkdir = readonly['mkdir', (_: MkdirParam) => IoResult<void>]

export const mkdir: RestFunc<Mkdir> =
    doRest('mkdir')

// readFile

export type ReadFile = readonly['readFile', (_: string) => IoResult<Vec>]

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

export type ReaddirParam = readonly[string, ReaddirOptions]

export type Readdir = readonly['readdir', (_: ReaddirParam) => IoResult<readonly Dirent[]>]

export const readdir: RestFunc<Readdir> =
    doRest('readdir')

// writeFile

export type WriteFileParam = readonly[string, Vec]

export type WriteFile = readonly['writeFile', (_: WriteFileParam) => IoResult<void>]

export const writeFile: RestFunc<WriteFile> =
    doRest('writeFile')

// Fs

export type Fs = Mkdir | ReadFile | Readdir | WriteFile

// error

export type Error = ['error', (_: string) => void]

export const error: Func<Error> =
    do_('error')

// log

export type Log = ['log', (_: string) => void]

export const log: Func<Log> =
    do_('log')

// Console

export type Console = Log | Error

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

export type RequestListener = (_: IncomingMessage) => ServerResponse

export type CreateServer = ['createServer', (_: RequestListener) => Server]

export const createServer: Func<CreateServer> =
    do_('createServer')

// listen

export type Listen = ['listen', (_: readonly[Server, number]) => void]

export const listen: RestFunc<Listen> =
    doRest('listen')

// HTTP

export type Http = CreateServer | Listen

// Wait forever

export type Forever = ['forever', () => never]

export const forever: Func<Forever> =
    do_('forever')

// Node

export type NodeOp =
    | All
    | Fetch
    | Console
    | Fs
    | Http
    | Forever

export type NodeEffect<T> = Effect<NodeOp, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOp>

export type NodeProgram = (argv: readonly string[]) => Effect<NodeOp, number>
