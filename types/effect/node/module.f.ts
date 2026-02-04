import type { Vec } from "../../bit_vec/module.f.ts"
import type { Effect, ToAsyncOperationMap } from "../module.f.ts"

export type NodeOperations = {
    readonly log: readonly[string, void]
    readonly readFile: readonly[string, Vec]
    readonly writeFile: readonly[readonly[string, Vec], void]
}

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>
