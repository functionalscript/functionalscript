/**
 * - set
 * -
 */

import type { RangeMap } from "../../types/range_map/types.ts"

export type RuleMap = {
    readonly[K in string]: SymbolMap
}

export type SymbolMap = RangeMap<Repeat>

export type Repeat<
