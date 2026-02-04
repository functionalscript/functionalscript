import type { Vec } from "../../bit_vec/module.f.ts"
import type { Do, Effect, ToAsyncOperationMap } from "../module.f.ts"

export type NodeOperations = {
    readonly log: readonly[string, void]
    readonly readFile: readonly[string, Vec]
    readonly writeFile: readonly[readonly[string, Vec], void]
}

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeDo<T> = Do<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

export type NodeProgram = (argv: readonly string[]) => NodeEffect<number>

export const log = (message: string) => <T>(c: () => NodeEffect<T>): NodeDo<T> =>
    ['do', 'log', message, c]

export const readFile = (path: string) => <T>(c: (data: Vec) => NodeEffect<T>): NodeDo<T> =>
    ['do', 'readFile', path, c]

export const writeFile = (path: string, data: Vec) => <T>(c: () => NodeEffect<T>): NodeDo<T> =>
    ['do', 'writeFile', [path, data], c]
