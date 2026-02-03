export type Effect<T> = Pure<T> | Do<T>

export type Pure<T> = readonly['pure', T]

export type Do<T> = readonly['do', string, unknown, (input: unknown) => Effect<T>]

export type Operation = {
    readonly[command in string]: readonly[unknown, unknown]
}

export type AsyncOperationMap<O extends Operation> = {
    readonly[K in keyof O]:
        (payload: O[K][0]) => Promise<O[K][1]>
}

// Node.js specific effects

export type NodeEffect<T> = Pure<T> | NodeDo<T>

export type NodeOperations = {
    readonly 'console.log': readonly[string, void]
    readonly 'fs.promises.readFile': readonly[string, Uint8Array]
}

export type NodeOne<T, K extends keyof NodeOperations> =
    readonly['do', K, NodeOperations[K][0], (input: NodeOperations[K][1]) => NodeEffect<T>]

export type NodeDo<T> = { readonly[K in keyof NodeOperations]: NodeOne<T, K> }[keyof NodeOperations]

export type NodeOperationMap = AsyncOperationMap<NodeOperations>
