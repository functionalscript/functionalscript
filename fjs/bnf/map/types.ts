/**
 * Mapping functions for transforming BNF abstract syntax trees.
 *
 * @module
 */

import type { Result } from '../../types/result/types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { StateFold } from '../../types/function/operator/types.ts'

export type Meta<M, T> = readonly[value: T, meta: M]

export type Out<M, T> = Result<Meta<M, T>, string>

// one.

export type OneMap<MI, I, MO, O> =
    (i: Meta<MI, I>) => Out<MO, O>

export type TerminalMap<MI, MO, O> = OneMap<MI, number, MO, O>

// sequence. [...v]

export type SequenceMeta<M, T extends readonly unknown[]> = Meta<M, T>

export type SequenceMap<MI, I extends readonly unknown[], MO, O> =
    (i: SequenceMeta<MI, I>) => Out<MO, O>

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

export type VariantMap<MI, I extends object, MO, O> =
    (i: VariantMeta<MI, I>) => Out<MO, O>

// repeat 0+. if recognized as `T = () => { some: T, none: [] }`

export type RepeatMap<MI, I, S, MO, O> =
    StateFold<Meta<MI, I>, S, Out<MO, O>>
