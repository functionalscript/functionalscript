import type { Vec } from "../bit_vec/module.f.ts"
import { fromVec, toVec } from "../uint8array/module.f.ts"
import { promises } from 'fs'

export type Operations = {
    readonly[command in string]: readonly[unknown, unknown]
}

export type Pure<T> = readonly['pure', T]

export type Effect<O extends Operations, T> = Pure<T> | Do<O, T>

type One<O extends Operations, T, K extends keyof O> =
    readonly['do', K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = { readonly[K in keyof O]: One<O, T, K> }[keyof O]

export type ToAsyncOperationMap<O extends Operations> = {
    readonly[K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}

export const run = <O extends Operations>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<O, T>>(effect: Effect<O, T>): Promise<T> =>
{
    while (true) {
        if (effect[0] === 'pure') {
            return effect[1]
        }
        const [, command, payload, continuation] = effect
        const operation = map[command]
        const result = await operation(payload)
        effect = continuation(result)
    }
}

// Node.js

export type NodeOperations = {
    readonly log: readonly[string, void]
    readonly readFile: readonly[string, Vec]
    readonly writeFile: readonly[readonly[string, Vec], void]
}

export type NodeEffect<T> = Effect<NodeOperations, T>

export type NodeOperationMap = ToAsyncOperationMap<NodeOperations>

const { readFile, writeFile } = promises

const nodeOperationMap: NodeOperationMap = {
    log: async (message: string): Promise<void> => console.log(message),
    readFile: async(path: string): Promise<Vec> => toVec(await readFile(path)),
    writeFile: ([path, data]: readonly[string, Vec]): Promise<void> => writeFile(path, fromVec(data))
}

export const nodeRun = run(nodeOperationMap)
