/** Type-level API of normalized scalar FAST loops. */

import type { Block, Definition, Value } from '../types.ts'

/** The condition, continuing block and next state of a scalar loop. */
export type ScalarLoop = {
    readonly condition: Value
    readonly step: { readonly statements: readonly Definition[]; readonly exit: Block['exit'] }
    readonly next: Value
}
