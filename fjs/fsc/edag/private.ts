/**
 * Implementation-private types for `fjs/fsc/edag/module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'

/** The nodes a reference can name: one per import, and one per entry lowered so far. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
}
