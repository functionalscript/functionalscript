import type { StructTs, Ts, TupleTs } from "../../../rtti/ts/types.ts"
import type { Type } from "../../../rtti/types.ts"
import type { RequiredMap } from "../../../types/object/types.ts"
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

export type VariantInfo<MI, K extends string, RI extends RequiredMap<K, Type>, MO, RO extends Type> = {
    readonly ri: RI
    readonly ro: RO
    readonly map: VariantMap<MI, K, StructTs<RI>, MO, Ts<RO>>
}
