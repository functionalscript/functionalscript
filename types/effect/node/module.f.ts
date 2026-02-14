import type { Vec } from '../../bit_vec/module.f.ts'
import type { Result } from '../../result/module.f.ts'
import { type Do, type Effect, type ToAsyncOperationMap, do_ } from '../module.f.ts'

export type IoResult<T> = Result<T, unknown>

// mkdir

export type MakeDirectoryOptions = { readonly recursive: true }

export type MkdirParam = readonly[string, MakeDirectoryOptions?]

export type Mkdir = { readonly mkdir: readonly [MkdirParam, IoResult<void>] }

export const mkdir =
    <O extends Mkdir>(...p: MkdirParam): Do<O, IoResult<void>> =>
    do_('mkdir', p)

// readFile

export type ReadFile = { readonly readFile: readonly [string, IoResult<Vec>] }

export const readFile =
    <O extends ReadFile>(path: string): Do<O, IoResult<Vec>> =>
    do_('readFile', path)

// readdir

export type ReaddirOptions = { readonly recursive?: true }

export type ReaddirParam = readonly[string, ReaddirOptions]

export type Readdir = {
    readonly readdir: readonly[ReaddirParam, IoResult<readonly string[]>]
}

export const readdir =
    <O extends Readdir>(...p: ReaddirParam): Do<O, IoResult<readonly string[]>> =>
    do_('readdir', p)

// writeFile

export type WriteFileParam = readonly[string, Vec]

export type WriteFile = { readonly writeFile: readonly [WriteFileParam, IoResult<void>] }

export const writeFile =
    <O extends WriteFile>(...p: WriteFileParam): Do<O, IoResult<void>> =>
    do_('writeFile', p)

// Fs

export type Fs = Mkdir & ReadFile & Readdir & WriteFile

// Console

export type Error = { readonly error: readonly [string, void] }

export type Log = { readonly log: readonly [string, void] }

export const log =
    <O extends Console>(msg: string): Do<O, void> =>
    do_('log', msg)

export const error =
    <O extends Console>(msg: string): Do<O, void> =>
    do_('error', msg)

export type Console = Log & Error

// Node

export type NodeOperations =
    & Console
    & Fs

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
