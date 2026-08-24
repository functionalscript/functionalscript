import type { Exp } from '../types.ts'

export type ExpOp = Extract<Exp, readonly unknown[]>

export type Context = {
    readonly frame: unknown,
    readonly args: readonly unknown[],
}

type Next0<T extends ExpOp, K extends ExpOp[0]> =
    T extends readonly [infer Op, ...readonly unknown[]]
        ? K extends Op
            ? (c: Context, r: T) => unknown
            : never
        : never

type Next<K extends ExpOp[0]> = Next0<ExpOp, K>

export type Map = {
    readonly[K in ExpOp[0]]: Next<K>
}

type Get0<T extends ExpOp, K extends ExpOp[0]> =
    T extends readonly [infer Op, ...readonly unknown[]]
        ? K extends Op
            ? T
            : never
        : never

export type Get<K extends ExpOp[0]> = Get0<ExpOp, K>
