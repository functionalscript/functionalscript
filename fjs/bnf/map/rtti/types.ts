import type { Ts } from "../../../rtti/ts/types.ts"
import type { Type } from "../../../rtti/types.ts"
import type { SequenceMap, TerminalMap } from "../types.ts"

export type TerminalMapInfo<MI, MO, RO extends Type> = {
    readonly ro: RO
    readonly map: TerminalMap<MI, MO, Ts<RO>>
}

export type SequenceMapInfo<MI, RI extends readonly Type[], MO, RO extends Type> = {
    readonly ri: RI
    readonly ro: RO
    readonly map: SequenceMap<MI, Ts<RI>, MO, Ts<RO>>
}
