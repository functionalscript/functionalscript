import type { Vec } from "../../bit_vec/module.f.ts"
import type { ToAsyncOperationMap, Pure } from "../module.f.ts"

export type NodeEffect<T> = Pure<T> | NodeDo<T>

export type NodeOperations = {
    readonly log: readonly[string, void]
    readonly readFile: readonly[string, Vec]
}

export type NodeOne<T, K extends keyof NodeOperations> =
    readonly['do', K, NodeOperations[K][0], (input: NodeOperations[K][1]) => NodeEffect<T>]

export type NodeDo<T> = { readonly[K in keyof NodeOperations]: NodeOne<T, K> }[keyof NodeOperations]

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>
