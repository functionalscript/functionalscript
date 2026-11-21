/** Immutable state within one memo invocation. @module */
import type { ExpOp, Over } from '../types.ts'
import type { Tail } from '../operations/types.ts'
import type { EdagValue } from '../value/types.ts'

export type _Cache = readonly (readonly [number, EdagValue])[]

/**
 * What an invocation threads through its evaluation: the values it keeps,
 * and the evaluator of a node over operands `E`, built once for the
 * invocation. The evaluator takes this state and answers it, so the type
 * names itself.
 */
export type _State<C, E> = readonly [kept: C, run: (node: Over<ExpOp, E>, state: _State<C, E>) => Tail<_State<C, E>>]
