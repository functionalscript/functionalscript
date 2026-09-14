/**
 * Implementation-private types for the DJS AST evaluator.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Array, Unknown } from '../../media/datajs/types.ts'
import type { AstBody, AstModuleRef } from './types.ts'

/** An evaluation in progress: the body, its arguments, and the values so far. */
export type _RunState = {
    readonly body: AstBody
    readonly args: Array
    readonly consts: List<Unknown>
}

/**
 * A reference as the sweep counts it: the `const` or import it rests on,
 * and the keys the accesses on it apply, outermost first — none for a
 * reference to the whole.
 */
export type _Ref = {
    readonly ref: AstModuleRef
    readonly keys: readonly string[]
}

/**
 * The sweep from the export downwards: which entries it has reached, as a
 * set of indices spelled as a bigint, and every reference those entries
 * make.
 */
export type _Reach = {
    readonly reachable: bigint
    readonly refs: List<_Ref>
}

/**
 * A container node a reference reaches: its group — a `const`'s index, or a
 * module's id — the keys from there, and whether the group is a module.
 */
export type _Node = {
    readonly group: string
    readonly keys: readonly string[]
    readonly aref: boolean
}
