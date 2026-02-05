import type { Effect, Operations, ToAsyncOperationMap } from "./module.f.ts"

export const asyncRun =
    <O extends Operations>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<O, T>>(effect: Effect<O, T>): Promise<T> =>
{
    while (true) {
        if ('pure' in effect) {
            return effect.pure
        }
        const [command, payload, continuation] = effect.do
        const operation = map[command]
        const result = await operation(payload)
        effect = continuation(result)
    }
}
