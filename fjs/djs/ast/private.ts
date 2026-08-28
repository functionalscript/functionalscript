/**
 * Implementation-private types for the DJS AST evaluator.
 */

import type { List } from '../../types/list/types.ts'
import type { Entry } from '../../types/ordered_map/types.ts'
import type { Array, Unknown } from '../types.ts'
import type { AstBody } from './types.ts'

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
