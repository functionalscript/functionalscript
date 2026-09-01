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
    readonly map: TerminalMap<MI, MO, NoInfer<Ts<RO>>>
}

// Sequence

export type SequenceInfo<MI, RI extends readonly Type[], MO, RO extends Type> = {
    readonly tag: 'sequence'
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<MI, NoInfer<TupleTs<RI>>, MO, NoInfer<Ts<RO>>>
}

// Variant

type VariantTs<RI extends { readonly[K in keyof RI]: Type }> = {
    readonly[K in keyof RI as K extends string | number ? `${K}` : never]: Ts<RI[K]>
}

export type VariantInfo<MI, RI extends { readonly[K in keyof RI]: Type }, MO, RO extends Type> = {
    readonly tag: 'variant'
    readonly ri: RI
    readonly ro: RO
    readonly map: VariantMap<MI, NoInfer<VariantTs<RI>>, MO, NoInfer<Ts<RO>>>
}

// Repeat

export type RepeatInfo<MI, RI extends Type, S, MO, RO extends Type> = {
    readonly tag: 'repeat'
    readonly ri: RI
    readonly ro: RO
    readonly map: RepeatMap<MI, NoInfer<Ts<RI>>, S, MO, NoInfer<Ts<RO>>>
}

declare const mapped: unique symbol

export type MappedInfo<T> = T & { readonly[mapped]: true }

export type Mapped =
    | MappedInfo<{
        readonly tag: 'terminal'
        readonly ri: Number
        readonly ro: Type
        readonly map: (...i: any[]) => unknown
    }>
    | MappedInfo<{
        readonly tag: 'sequence'
        readonly ri: readonly Type[]
        readonly ro: Type
        readonly map: (...i: any[]) => unknown
    }>
    | MappedInfo<{
        readonly tag: 'variant'
        readonly ri: Readonly<Record<string, Type>>
        readonly ro: Type
        readonly map: (...i: any[]) => unknown
    }>
    | MappedInfo<{
        readonly tag: 'repeat'
        readonly ri: Type
        readonly ro: Type
        readonly map: {
            readonly init: unknown
            readonly update: (...i: any[]) => unknown
            readonly end: (...i: any[]) => unknown
        }
    }>

export type Terminal = <MI, MO, RO extends Type>(
    info: TerminalInfo<MI, MO, RO>,
) => MappedInfo<TerminalInfo<MI, MO, RO>>

export type Sequence = <MI, RI extends readonly Type[], MO, RO extends Type>(
    info: SequenceInfo<MI, RI, MO, RO>,
) => MappedInfo<SequenceInfo<MI, RI, MO, RO>>

export type Variant = <MI, RI extends { readonly[K in keyof RI]: Type }, MO, RO extends Type>(
    info: VariantInfo<MI, RI, MO, RO>,
) => MappedInfo<VariantInfo<MI, RI, MO, RO>>

export type Repeat = <MI, RI extends Type, S, MO, RO extends Type>(
    info: RepeatInfo<MI, RI, S, MO, RO>,
) => MappedInfo<RepeatInfo<MI, RI, S, MO, RO>>

export type Identity = {
    readonly tag: Tag
    readonly ri: Type
    readonly ro: Type
    readonly map: null
}

export type Base = Mapped | Identity

export type RuleInfo = readonly[Rule, Mapped]

//
