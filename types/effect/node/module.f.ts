import type { Vec } from "../../bit_vec/module.f.ts"
import type { Result } from "../../result/module.f.ts"
import { type Do, type Effect, type ToAsyncOperationMap, type Operations, do_ } from "../module.f.ts"

export type IoResult<T> = Result<T, unknown>

export type FileOperations = {
    readonly readFile: readonly [string, IoResult<Vec>]
    readonly writeFile: readonly [readonly [string, Vec], IoResult<void>]
    readonly mkdir: readonly [string, IoResult<void>]
}

export const readFile =
    (path: string) =>
    <O extends FileOperations, T>(f: (r: IoResult<Vec>) => Effect<O, T>): Do<O, T> =>
    do_('readFile', path, f)

export const writeFile =
    (path: string, data: Vec) =>
    <O extends FileOperations, T>(f: (r: IoResult<void>) => Effect<O, T>): Do<O, T> =>
    do_('writeFile', [path, data], f)

export type ConsoleOperations = {
    readonly log: readonly [string, void]
}

export const log =
    (msg: string) =>
    <O extends ConsoleOperations, T>(f: () => Effect<O, T>): Do<O, T> =>
    do_('log', msg, f)

export type NodeOperations =
    & ConsoleOperations
    & FileOperations

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
