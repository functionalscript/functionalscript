import type { Ts, TupleTs } from "../../../rtti/ts/types.ts"
import type { Type } from "../../../rtti/types.ts"
import type { SequenceMap, TerminalMap, VariantMap } from "../types.ts"

export type TerminalInfo<MI, MO, RO extends Type> = {
    readonly ro: RO
    readonly map: TerminalMap<MI, MO, Ts<RO>>
}

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
