import type { Effect, Operations } from "../module.f.ts"

export type MemOperationMap<O extends Operations, S> = {
    readonly [K in keyof O]: (state: S, payload: O[K][0]) => readonly[S, O[K][1]]
}

export const run =
    <O extends Operations, S>(o: MemOperationMap<O, S>) =>
    (state: S) =>
    <T>(effect: Effect<O, T>): readonly[S, T] =>
{
    let s = state
    let e = effect
    while (true) {
        if ('pure' in e) {
            return [s, e.pure]
        }
        const [cmd, payload, cont] = e.do
        const operation = o[cmd]
        const [ns, m] = operation(s, payload)
        s = ns
        e = cont(m)
    }
}
