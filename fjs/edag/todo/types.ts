import type { Exp } from '../types.ts'

type ExpOp = Extract<Exp, readonly unknown[]>

type Next<T extends ExpOp, K> =
    T extends readonly [infer Op, ...infer R]
        ? K extends Op
            ? R
            : never
        : never

type Map = {
    readonly[K in ExpOp[0]]: Next<ExpOp, K>
}
