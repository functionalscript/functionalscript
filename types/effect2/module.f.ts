import type { Vec } from "../bit_vec/module.f.ts"

export type Operation = {
    readonly[command in string]: readonly[unknown, unknown]
}

export type Pure<T> = readonly['pure', T]

export type Effect<O extends Operation, T> = Pure<T> | Do<O, T>

type One<O extends Operation, T, K extends keyof O> =
    readonly['do', K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operation, T> = { readonly[K in keyof O]: One<O, T, K> }[keyof O]

// Node.js

export type NodeOperations = {
    readonly log: readonly[string, void]
    readonly readFile: readonly[string, Vec]
    readonly writeFile: readonly[readonly[string, Vec], void]
}

export type NodeEffect<T> = Effect<NodeOperations, T>
