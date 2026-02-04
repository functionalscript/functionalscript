import type { Vec } from "../../bit_vec/module.f.ts"
import type { Result } from "../../result/module.f.ts"
import type { Effect, ToAsyncOperationMap } from "../module.f.ts"

export type IoResult<T> = Result<T, unknown>

export type FileOperations = {
    readonly readFile: readonly[string, IoResult<Vec>]
    readonly writeFile: readonly[readonly[string, Vec], IoResult<void>]
}

export type ConsoleOperations = {
    readonly log: readonly[string, void]
}

export type NodeOperations =
    & ConsoleOperations
    & FileOperations

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>
