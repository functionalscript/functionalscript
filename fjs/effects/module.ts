import { match, type Effect, type Operation, type ToAsyncOperationMap } from "./module.f.ts"

export const asyncRun =
    <O extends Operation>(map: ToAsyncOperationMap<O>) =>
    async<T, E extends Effect<O, T>>(effect: Effect<O, T>): Promise<T> =>
{
    const next = match(map)
    while (true) {
        const r = next(effect)
        if (r[0] === 'done') {
            return r[1]
        }
        effect = r[2](await r[1])
    }
}
