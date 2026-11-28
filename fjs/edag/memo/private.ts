/** Immutable state within one memo invocation. @module */
import type { Exp, ExpOp, Over } from '../types.ts'
import type { Tail } from '../operations/types.ts'
import type { EdagValue } from '../value/types.ts'
import type { RefMap } from '../../types/ref_map/types.ts'

export type _Cache = readonly (readonly [number, EdagValue])[]

/** Values kept by node, newest first. */
export type _Pairs = readonly [node: ExpOp, value: EdagValue, rest: _Pairs] | null

/**
 * The values an invoked body has kept by node: how many, the first few as
 * a list, and the rest in a reference map.
 */
export type _Kept = readonly [size: number, pairs: _Pairs, rest: RefMap]

/**
 * What an invocation threads through its evaluation: the values it keeps,
 * and the evaluator of a node over operands `E`, built once for the
 * invocation. The evaluator takes this state and answers it, so the type
 * names itself.
 */
export type _State<C, E> = readonly [kept: C, run: (node: Over<ExpOp, E>, state: _State<C, E>) => Tail<_State<C, E>>]

/**
 * What an invoked body threads through its evaluation: {@link _State} over
 * the values it keeps by node, with how many nodes it may still evaluate.
 */
export type _Steps = readonly [kept: _Kept, run: (node: Over<ExpOp, Exp>, state: _Steps) => Tail<_Steps>, steps: number]
