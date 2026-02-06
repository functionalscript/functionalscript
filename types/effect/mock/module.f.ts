import type { Effect, Operations } from "../module.f.ts"

export type MemOperationMap<O extends Operations, S> = {
    readonly [K in keyof O]: (state: S, payload: O[K][0]) => readonly[S, O[K][1]]
}

export const run = <O extends Operations, S>(o: MemOperationMap<O, S>) => (state: S) => <T>(effect: Effect<O, T>): T => {
    let s = state
    while (true) {
        if ('pure' in effect) {
            return effect.pure
        }
        const [cmd, payload, cont] = effect.do
        const [ns, m] = o[cmd](s, payload)
        s = ns
        effect = cont(m)
    }
}
