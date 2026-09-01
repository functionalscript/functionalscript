/**
 * Runtime type information for BNF rule mappings.
 *
 * @module
 */

import type { Ts, TupleTs } from '../../../rtti/ts/types.ts'
import type { Type, Number } from '../../../rtti/types.ts'
import type { Rule } from '../../types.ts'
import type { RepeatMap, SequenceMap, TerminalMap, VariantMap } from '../types.ts'

export type Tag = 'terminal' | 'sequence' | 'variant' | 'repeat'

// One

export type TerminalInfo<MI, MO, RO extends Type> = {
    readonly tag: 'terminal'
    readonly ri: Number
    readonly ro: RO
    readonly map: TerminalMap<MI, MO, Ts<RO>>
}

// Sequence

export type SequenceInfo<MI, RI extends readonly Type[], MO, RO extends Type> = {
    readonly tag: 'sequence'
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<MI, TupleTs<RI>, MO, Ts<RO>>
}

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

// Repeat

export type RepeatInfo<MI, RI extends Type, S, MO, RO extends Type> = {
    readonly tag: 'repeat'
    readonly ri: RI
    readonly ro: RO
    readonly map: RepeatMap<MI, Ts<RI>, S, MO, Ts<RO>>
}

export type Mapped =
    | TerminalInfo<any, any, any>
    | SequenceInfo<any, any, any, any>
    | VariantInfo<any, any, any, any>
    | RepeatInfo<any, any, any, any, any>

export type Identity = {
    readonly tag: Tag
    readonly ri: Type
    readonly ro: Type
    readonly map: null
}

export type Base = Mapped | Identity

export type RuleInfo = readonly[Rule, Mapped]

//
