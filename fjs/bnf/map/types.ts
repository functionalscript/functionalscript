import type { StringMap } from "../../types/object/types.ts"
import type { DataRule, Rule } from "../types.ts"

export type Meta<M, T> = readonly[value: T, meta: M]

//

export type RuleMap<K extends DataRule, V> = readonly[K, V]

// one

export type Map<R extends DataRule, M, I, O> = RuleMap<R, (value: Meta<M, I>) => Meta<M, O>>

export type TerminalMap<M, O> = Map<number, M, number, O>

// sequence

type MapMeta<M, I extends readonly unknown[]> = {
    readonly[K in keyof I]: Meta<M, I[K]>
}

export type SequenceMap<M, I extends readonly unknown[], O> =
    (...value: MapMeta<M, I>) => Meta<M, O>

export type StringSequenceMap<M, O> = SequenceMap<M, readonly number[], O>

// variant

export type VariantMeta<M, I extends StringMap<unknown>> = {
    readonly[K in keyof I]: readonly[K, Meta<M, I[K]>]
}

export type VariantMap<M, I extends StringMap<unknown>, O> =
    (value: VariantMeta<M, I>) => Meta<M, O>

// repeat

export type RepeatMap<M, I, S, O> = {
    readonly init: S
    readonly update: (state: S, value: Meta<M, I>) => S
    readonly end: (state: S) => Meta<M, S>
}

// Pairs
