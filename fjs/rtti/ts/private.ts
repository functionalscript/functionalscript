/**
 * Implementation-private types for the RTTI-to-TypeScript printer.
 */

import type { Printer } from '../../types/ts/types.ts'
import type { RuleSet } from '../data/types.ts'

export type _Ctx = {
    readonly ts: Printer
    readonly ids: readonly (readonly [string, string])[]
    readonly rules: RuleSet
}
