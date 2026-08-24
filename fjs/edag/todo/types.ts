import type { Exp } from '../types.ts'

type ExpOp = Extract<Exp, readonly unknown[]>

export type Context = {
    readonly frame: unknown,
    readonly args: readonly unknown[],
}

type Next<T extends ExpOp, K> =
    T extends readonly [infer Op, ...readonly unknown[]]
        ? K extends Op
            ? (c: Context, r: T) => unknown
            : never
        : never

export type Map = {
    readonly[K in ExpOp[0]]: Next<ExpOp, K>
}
