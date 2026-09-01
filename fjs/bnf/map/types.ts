export type Meta<M, T> = readonly[value: T, meta: M]

// one.

export type OneMap<MI, I, MO, O> =
    (i: Meta<MI, I>) => Meta<MO, O>

export type TerminalMap<MI, MO, O> = OneMap<MI, number, MO, O>

// sequence. [...v]

export type SequenceMeta<M, T extends readonly unknown[]> = {
    readonly[K in keyof T]: Meta<M, T[K]>
}

export type SequenceMap<MI, I extends readonly unknown[], MO, O> =
    (...i: SequenceMeta<MI, I>) => Meta<MO, O>

// variant

export type VariantMeta<M, T extends object> = {
    readonly[K in keyof T]: readonly[K, Meta<M, T[K]>]
}[keyof T]

export type VariantMap<MI, I extends object, MO, O> =
    (i: VariantMeta<MI, I>) => Meta<MO, O>

// repeat 0+. if recognized as `T = () => { some: T, none: [] }`

export type Repeat<MI, I, S, MO, O> = {
    readonly init: S
    readonly update: (state: S, i: Meta<MI, I>) => S
    readonly end: (state: S) => Meta<MO, O>
}
