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
 * One link operation in progress: the modules resolved so far, each under
 * its identity and boxed, since an EDAG may be `null` and `at` says `null` for
 * an identity it has not seen; and the chain of module identities being
 * followed, in which an identity met twice is a cycle.
 */
export type _Link = {
    readonly complete: OrderedMap<readonly [Exp]>
    readonly stack: List<string>
}

/** A module's imports being resolved: the link so far, and the EDAGs bound to the imports resolved so far, in their order. */
export type _Binding = {
    readonly context: _Link
    readonly bound: readonly Exp[]
}
