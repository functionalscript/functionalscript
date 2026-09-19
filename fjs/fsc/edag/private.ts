/**
 * Implementation-private types for `fjs/fsc/edag/module.f.mjs`.
 *
 * @module
 */

import type { Exp } from '../../edag/types.ts'
import type { List } from '../../types/list/types.ts'
import type { OrderedMap } from '../../types/ordered_map/types.ts'

/** The nodes a reference can name: one per import, one per entry lowered so far, and the arguments of the function being lowered. */
export type _Nodes = {
    readonly parameters: readonly Exp[]
    readonly consts: readonly Exp[]
    readonly args: Exp
}

/**
 * One link operation in progress: the modules resolved so far under their
 * identities, and the chain being followed, in which a repeated identity is
 * a cycle.
 */
export type _Link = {
    readonly complete: OrderedMap<_Resolved>
    readonly stack: List<string>
}

/** A module's imports being resolved: the link so far, and the EDAGs bound to the imports resolved so far, in their order. */
export type _Binding = {
    readonly context: _Link
    readonly bound: readonly Exp[]
}

/**
 * A module's full result and its default binding. Select once so repeated
 * imports share the same computation, including its evaluation anchors.
 */
export type _Resolved = {
    readonly exports: Exp
    readonly default: Exp
}
