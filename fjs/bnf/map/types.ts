/**
 * Mapping functions for transforming BNF abstract syntax trees.
 *
 * @module
 */

import type { Result } from '../../types/result/types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { StateFold } from '../../types/function/operator/types.ts'
import type { Meta } from '../matcher/types.ts'

export type { Meta } from '../matcher/types.ts'

export type Out<M, T> = Result<Meta<M, T>, string>

// one.

export type OneMap<M, I, O> =
    (i: Meta<M, I>) => Out<M, O>

export type TerminalMap<M, O> = OneMap<M, number, O>

// sequence. [...v]

export type SequenceMeta<M, T extends readonly unknown[]> = Meta<M, T>

export type SequenceMap<M, I extends readonly unknown[], O> =
    (i: SequenceMeta<M, I>) => Out<M, O>

// variant

export type VariantValue<T extends object> = {
    readonly[K in keyof T]: K extends string | number
        ? readonly[`${K}`, T[K]]
        : never
}[keyof T]

type _NumericVariantKey = Assert<Equal<
    VariantValue<{ readonly 0: string }>,
    readonly['0', string]
>>

export type VariantMeta<M, T extends object> = Meta<M, VariantValue<T>>

export type VariantMap<M, I extends object, O> =
    (i: VariantMeta<M, I>) => Out<M, O>

// repeat 0+. if recognized as `T = () => { some: T, none: [] }`

export type RepeatMap<M, I, S, O> =
    StateFold<Meta<M, I>, S, Out<M, O>>
