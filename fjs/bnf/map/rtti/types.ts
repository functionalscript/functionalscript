import type { Assert } from "../../../asserts/types.ts"
import type { Ts, TupleTs } from "../../../rtti/ts/types.ts"
import type { Type } from "../../../rtti/types.ts"
import type { RepeatMap, SequenceMap, TerminalMap, VariantMap } from "../types.ts"

export type Tag = 'terminal' | 'sequence' | 'variant' | 'repeat'

export type Base = {
    readonly tag: Tag
    readonly ro: Type
    readonly map: unknown
}

export type TerminalInfo<MI, MO, RO extends Type> = {
    readonly tag: 'terminal'
    readonly ro: RO
    readonly map: TerminalMap<MI, MO, Ts<RO>>
}

type _Terminal = Assert<TerminalInfo<unknown, unknown, Type> extends Base ? true: false>

export type SequenceInfo<MI, RI extends readonly Type[], MO, RO extends Type> = {
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<MI, TupleTs<RI>, MO, Ts<RO>>
}

type VariantTs<RI extends { readonly[K in keyof RI]: Type }> = {
    readonly[K in keyof RI]: Ts<RI[K]>
}

export type VariantInfo<MI, RI extends { readonly[K in keyof RI]: Type }, MO, RO extends Type> = {
    readonly ri: RI
    readonly ro: RO
    readonly map: VariantMap<MI, VariantTs<RI>, MO, Ts<RO>>
}

export type RepeatInfo<MI, RI extends Type, S, MO, RO extends Type> = {
    readonly ri: RI
    readonly ro: RO
    readonly map: RepeatMap<MI, Ts<RI>, S, MO, Ts<RO>>
}
