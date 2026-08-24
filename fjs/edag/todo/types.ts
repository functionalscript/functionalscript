import type { Tuple } from '../../types/array/types.ts'
import type { Exp } from '../types.ts'

type ExpOp = Extract<Exp, readonly unknown[]>

type StaticKey = Exclude<ExpOp[0], 'frame' | 'args'>

type Next<T extends ExpOp, K> =
    T extends readonly [infer Op, ...infer R]
        ? K extends Op
            ? (...r: Tuple<R['length'], any>) => unknown
            : never
        : never

export type StaticMap = {
    readonly[K in StaticKey]: Next<ExpOp, K>
}
