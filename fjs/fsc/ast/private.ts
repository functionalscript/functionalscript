/**
 * Implementation-private types for the DJS AST evaluator.
 *
 * @module
 */

import type { List } from '../../types/list/types.ts'
import type { Entry } from '../../types/ordered_map/types.ts'
import type { Array, Unknown } from '../../media/datajs/types.ts'
import type { AstBody, AstModuleRef } from './types.ts'

/** An evaluation in progress: the body, its arguments, and the values so far. */
export type _RunState = {
    readonly body: AstBody
    readonly args: Array
    readonly consts: List<Unknown>
}

/** The state of folding an AST object's entries into evaluated entries. */
export type _FoldObjectState = {
    readonly runState: _RunState,
    readonly entries: List<Entry<Unknown>>
}

/**
 * The sweep from the export downwards: which entries it has reached, as a
 * set of indices spelled as a bigint, and every reference those entries
 * make.
 */
export type _Reach = {
    readonly reachable: bigint
    readonly refs: List<AstModuleRef>
}
