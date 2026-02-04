import type { Vec } from "../../bit_vec/module.f.ts"
import type { Result } from "../../result/module.f.ts"
import { pure, type DoAll, type Do, type Effect, type ToAsyncOperationMap } from "../module.f.ts"

export type IoResult<T> = Result<T, unknown>

export type FileOperations = {
    readonly readFile: readonly [string, IoResult<Vec>]
    readonly writeFile: readonly [readonly [string, Vec], IoResult<void>]
}

export const readFile =
    (path: string) =>
    <O extends FileOperations, T>(f: (r: IoResult<Vec>) => Effect<O, T>): DoAll<O, T> =>
    ['do', 'readFile', path, f] as Do<O, T, 'readFile'> as DoAll<O, T>

export const writeFile =
    (path: string, data: Vec) =>
    <O extends FileOperations, T>(f: (r: IoResult<void>) => Effect<O, T>): DoAll<O, T> =>
    ['do', 'writeFile', [path, data], f] as Do<O, T, 'writeFile'> as DoAll<O, T>

export type ConsoleOperations = {
    readonly log: readonly [string, void]
}

export type NodeOperations =
    & ConsoleOperations
    & FileOperations

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
