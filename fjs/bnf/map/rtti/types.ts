import type { Ts, TupleTs } from "../../../rtti/ts/types.ts"
import type { Type, Number } from "../../../rtti/types.ts"
import type { Rule } from "../../types.ts"
import type { RepeatMap, SequenceMap, TerminalMap, VariantMap } from "../types.ts"

export type Tag = 'terminal' | 'sequence' | 'variant' | 'repeat'

export type Base = {
    readonly tag: Tag
    readonly ri: Type
    readonly ro: Type
    readonly map: unknown
}

type AssertBase<T extends Base> = T

export type RuleInfo = readonly[Rule, Base]

// One

export type TerminalInfo<MI, MO, RO extends Type> = {
    readonly tag: 'terminal'
    readonly ri: Number
    readonly ro: RO
    readonly map: TerminalMap<MI, MO, Ts<RO>>
}

type _Terminal = AssertBase<TerminalInfo<unknown, unknown, Type>>

// Sequence

export type SequenceInfo<MI, RI extends readonly Type[], MO, RO extends Type> = {
    readonly tag: 'sequence'
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<MI, TupleTs<RI>, MO, Ts<RO>>
}

type _Sequence = AssertBase<SequenceInfo<unknown, readonly Type[], unknown, Type>>

// Variant

type VariantTs<RI extends { readonly[K in keyof RI]: Type }> = {
    readonly[K in keyof RI]: Ts<RI[K]>
}

export type VariantInfo<MI, RI extends { readonly[K in keyof RI]: Type }, MO, RO extends Type> = {
    readonly tag: 'variant'
    readonly ri: RI
    readonly ro: RO
    readonly map: VariantMap<MI, VariantTs<RI>, MO, Ts<RO>>
}

type _Variant = AssertBase<VariantInfo<unknown, { readonly[k in string]: Type }, unknown, Type>>

// Repeat

export type RepeatInfo<MI, RI extends Type, S, MO, RO extends Type> = {
    readonly tag: 'repeat'
    readonly ri: RI
    readonly ro: RO
    readonly map: RepeatMap<MI, Ts<RI>, S, MO, Ts<RO>>
}

type _Repeat = AssertBase<RepeatInfo<unknown, Type, unknown, unknown, Type>>

//
