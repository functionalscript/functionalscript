import type { RequiredMap, StringMap } from "../../types/object/types.ts"
import type { DataRule, Sequence, Variant } from "../types.ts"

export type Meta<M, T> = readonly[value: T, meta: M]

//

export type RuleMap<R extends DataRule, V> = readonly[R, V]

// one

export type Map<R extends DataRule, M, I, O> = RuleMap<R, (value: Meta<M, I>) => Meta<M, O>>

export type TerminalMap<M, O> = Map<number, M, number, O>

// sequence

type MapMeta<M, I extends readonly unknown[]> = {
    readonly[K in keyof I]: Meta<M, I[K]>
}

export type _SequenceMap<R extends DataRule, M, I extends readonly unknown[], O> = RuleMap<
    R,
    (...value: MapMeta<M, I>) => Meta<M, O>
>

export type SequenceMap<R extends Sequence, M, I extends readonly unknown[], O> =
    _SequenceMap<R, M, I, R>

export type StringSequenceMap<M, O> =
    _SequenceMap<string, M, readonly number[], O>

// variant

export type VariantMeta<M, I extends StringMap<unknown>> = {
    readonly[K in keyof I]: readonly[K, Meta<M, I[K]>]
}[keyof I]

export type VariantMap<
    R extends Variant,
    M,
    I extends RequiredMap<keyof R & string, unknown>,
    O
> = RuleMap<
    R,
    (value: VariantMeta<M, I>) => Meta<M, O>
>

// repeat

export type RepeatMap<M, I, S, O> = {
    readonly init: S
    readonly update: (state: S, value: Meta<M, I>) => S
    readonly end: (state: S) => Meta<M, O>
}

// Pairs
