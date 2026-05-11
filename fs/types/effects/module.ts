import type { Effect, Operation, ToAsyncOperationMap } from "./module.f.ts"

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
        const result = await operation(payload)
        effect = continuation(result)
    }
}
