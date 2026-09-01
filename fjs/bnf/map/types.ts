import type { RequiredMap } from "../../types/object/types.ts"

export type Meta<M, T> = readonly[value: T, meta: M]

// one

export type OneMap<MI, I, MO, O> =
    (i: Meta<MI, I>) => Meta<MO, O>

// sequence. [...v]

export type SequenceMeta<M, T extends readonly unknown[]> = {
    readonly[K in keyof T]: Meta<M, T[K]>
}

export type SequenceMap<MI, I extends readonly unknown[], MO, O> =
    (...i: SequenceMeta<MI, I>) => Meta<MO, O>

// variant

export type VariantMeta<M, T extends RequiredMap<string, unknown>> = {
    readonly[K in keyof T]: readonly[K, Meta<M, T[K]>]
}[keyof T]

export type VariantMap<MI, I extends RequiredMap<string, unknown>, MO, O> =
    (i: VariantMeta<MI, I>) => Meta<MO, O>
