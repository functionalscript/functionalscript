/**
 * Runtime type information for BNF rule mappings.
 *
 * @module
 */

import type { Ts, TupleTs } from '../../../rtti/ts/types.ts'
import type { Type, Number } from '../../../rtti/types.ts'
import type { AbstractRequiredMap } from '../../../types/object/types.ts'
import type { Rule } from '../../types.ts'
import type { RepeatMap, SequenceMap, TerminalMap, VariantMap } from '../types.ts'

export type Tag = 'terminal' | 'sequence' | 'variant' | 'repeat'

// One

export type TerminalInfo<M, RO extends Type> = {
    readonly tag: 'terminal'
    readonly ri: Number
    readonly ro: RO
    readonly map: TerminalMap<M, NoInfer<Ts<RO>>>
}

// Sequence

export type SequenceInfo<M, RI extends readonly Type[], RO extends Type> = {
    readonly tag: 'sequence'
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<M, NoInfer<TupleTs<RI>>, NoInfer<Ts<RO>>>
}

// Variant

type VariantTs<RI extends { readonly[K in keyof RI]: Type }> = {
    readonly[K in keyof RI as K extends string | number ? `${K}` : never]: Ts<RI[K]>
}

export type VariantInfo<M, RI extends { readonly[K in keyof RI]: Type }, RO extends Type> = {
    readonly tag: 'variant'
    readonly ri: RI
    readonly ro: RO
    readonly map: VariantMap<M, NoInfer<VariantTs<RI>>, NoInfer<Ts<RO>>>
}

// Repeat

export type RepeatInfo<M, RI extends Type, S, RO extends Type> = {
    readonly tag: 'repeat'
    readonly ri: RI
    readonly ro: RO
    readonly map: RepeatMap<M, NoInfer<Ts<RI>>, S, NoInfer<Ts<RO>>>
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
        readonly ri: AbstractRequiredMap<string, Type>
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

export type Terminal = <M, RO extends Type>(
    info: TerminalInfo<M, RO>,
) => MappedInfo<TerminalInfo<M, RO>>

export type Sequence = <M, RI extends readonly Type[], RO extends Type>(
    info: SequenceInfo<M, RI, RO>,
) => MappedInfo<SequenceInfo<M, RI, RO>>

export type Variant = <M, RI extends { readonly[K in keyof RI]: Type }, RO extends Type>(
    info: VariantInfo<M, RI, RO>,
) => MappedInfo<VariantInfo<M, RI, RO>>

export type Repeat = <M, RI extends Type, S, RO extends Type>(
    info: RepeatInfo<M, RI, S, RO>,
) => MappedInfo<RepeatInfo<M, RI, S, RO>>

export type Identity = {
    readonly tag: Tag
    readonly ri: Type
    readonly ro: Type
    readonly map: null
}

export type Base = Mapped | Identity

export type RuleInfo = readonly[Rule, Mapped]

//
