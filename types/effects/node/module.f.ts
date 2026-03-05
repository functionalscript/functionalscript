import type { Vec } from '../../bit_vec/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import {
    type Do, type Effect, type Func, type Operation, type ToAsyncOperationMap, do_
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
{
    const result = do_<All>('all')(a as readonly Effect<never, T>[])
    return result as Effect<O | All, readonly T[]>
}

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

export const mkdir =
    (...p: MkdirParam): Effect<Mkdir, IoResult<void>> =>
    do_<Mkdir>('mkdir')(p)

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

export const readdir =
    (...p: ReaddirParam): Effect<Readdir, IoResult<readonly Dirent[]>> =>
    do_<Readdir>('readdir')(p)

// writeFile

export type WriteFileParam = readonly[string, Vec]

export type WriteFile = readonly['writeFile', (_: WriteFileParam) => IoResult<void>]

export const writeFile =
    (...p: WriteFileParam): Effect<WriteFile, IoResult<void>> =>
    do_<WriteFile>('writeFile')(p)

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

// Node

export type NodeOp =
    | All
    | Fetch
    | Console
    | Fs

export type NodeEffect<T> = Effect<NodeOp, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOp>

export type NodeProgram = (argv: readonly string[]) => Effect<NodeOp, number>
