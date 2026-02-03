export type Effect<T> = Pure<T> | Do<T>

export type Pure<T> = readonly['pure', T]

export type Do<T> = readonly['do', string, unknown, (input: unknown) => Effect<T>]

export type Operation = {
    readonly[command in string]: readonly[unknown, unknown]
}

export type ToAsyncOperationMap<O extends Operation> = {
    readonly[K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}

export const run =
    <O extends Operation>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<T>>(effect: Effect<T>): Promise<T> =>
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
