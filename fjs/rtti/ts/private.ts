/**
 * Implementation-private types for the RTTI-to-TypeScript printer.
 *
 * @module
 */

import type { Printer } from '../../types/ts/types.ts'
import type { RuleSet, UnionSet } from '../data/types.ts'

export type _Ctx = {
    readonly ts: Printer
    readonly ids: readonly (readonly [string, string])[]
    readonly rules: RuleSet
}

/** Recursive inline unions print through this context-bound callback. */
export type _PrintUnion = (u: UnionSet) => string
