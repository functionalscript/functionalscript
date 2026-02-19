import type { Vec } from '../../bit_vec/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import { type Do, type Effect, type ToAsyncOperationMap, do_ } from '../module.f.ts'

export type IoResult<T> = Result<T, unknown>

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type MkdirParam = readonly[string, MakeDirectoryOptions?]

export type Mkdir = { readonly mkdir: readonly [MkdirParam, IoResult<void>] }

export const mkdir =
    (...p: MkdirParam): Do<Mkdir, IoResult<void>> =>
    do_('mkdir', p)

// readFile

export type ReadFile = { readonly readFile: readonly [string, IoResult<Vec>] }

export const readFile =
    (path: string): Do<ReadFile, IoResult<Vec>> =>
    do_('readFile', path)

// readdir

/**
 * Represents a directory entry (file or directory) in the filesystem
 * @see https://nodejs.org/api/fs.html#class-fsdirent
 */
export type Dirent = {
    readonly name: string
    readonly isFile: boolean
}

export type ReaddirOptions = {
    readonly recursive?: true
}

export type ReaddirParam = readonly[string, ReaddirOptions]

export type Readdir = {
    readonly readdir: readonly[ReaddirParam, IoResult<readonly Dirent[]>]
}

export const readdir =
    (...p: ReaddirParam): Do<Readdir, IoResult<readonly Dirent[]>> =>
    do_('readdir', p)

// writeFile

export type WriteFileParam = readonly[string, Vec]

export type WriteFile = { readonly writeFile: readonly [WriteFileParam, IoResult<void>] }

export const writeFile =
    (...p: WriteFileParam): Do<WriteFile, IoResult<void>> =>
    do_('writeFile', p)

// Fs

export type Fs = Mkdir & ReadFile & Readdir & WriteFile

// error

export type Error = { readonly error: readonly [string, void] }

export const error =
    (msg: string): Do<Error, void> =>
    do_('error', msg)

// log

export type Log = { readonly log: readonly [string, void] }

export const log =
    (msg: string): Do<Log, void> =>
    do_('log', msg)

// Console

export type Console = Log & Error

// Node

export type NodeOperations =
    & Console
    & Fs

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
