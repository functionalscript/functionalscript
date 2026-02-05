import type { Vec } from "../../bit_vec/module.f.ts"
import type { Result } from "../../result/module.f.ts"
import { type Do, type Effect, type ToAsyncOperationMap, type Operations, do_ } from "../module.f.ts"

export type IoResult<T> = Result<T, unknown>

export type MakeDirectoryOptions = { readonly recursive: true }

export type MkdirParam = readonly[string, MakeDirectoryOptions?]

export type WriteFileParam = readonly[string, Vec]

export type FileOperations = {
    readonly readFile: readonly [string, IoResult<Vec>]
    readonly writeFile: readonly [WriteFileParam, IoResult<void>]
    readonly mkdir: readonly [MkdirParam, IoResult<void>]
}

export const readFile =
    <O extends FileOperations>(path: string): Do<O, IoResult<Vec>> =>
    do_('readFile', path)

export const writeFile =
    <O extends FileOperations>(...p: WriteFileParam): Do<O, IoResult<void>> =>
    do_('writeFile', p)

export const mkdir =
    <O extends FileOperations>(...p: MkdirParam): Do<O, IoResult<void>> =>
    do_('mkdir', p)

export type ConsoleOperations = {
    readonly log: readonly [string, void]
}

export const log =
    <O extends ConsoleOperations>(msg: string): Do<O, void> =>
    do_('log', msg)

export type NodeOperations =
    & ConsoleOperations
    & FileOperations

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
