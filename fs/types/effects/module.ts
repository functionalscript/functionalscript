import type { Effect, Operation, ToAsyncOperationMap } from "./module.f.ts"

let i = 0

export const asyncRun =
    <O extends Operation>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<O, T>>(effect: Effect<O, T>): Promise<T> =>
{
    while (true) {
        const {value} = effect
        if (value.length === 1) {
            return value[0]
        }
        const [command, payload, continuation] = value
        const operation = map[command]
        const x = ++i
        console.log('Running operation #', x, ':', command, payload)
        const result = await operation(...payload)
        console.log('Result of operation #', x, ':', result)
        effect = continuation(result)
    }
}
