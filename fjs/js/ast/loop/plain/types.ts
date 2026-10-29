/**
 * Type-level API of normalized plain FAST loop planning.
 *
 * @module
 */

import type { Definition, Value } from '../../types.ts'
import type { ScalarLoop } from '../types.ts'

/**
 * The condition keeps its complete required prefix. Other regions duplicate
 * only the identity-free prefix dependencies they actually read. The step
 * establishes each copied dependency immediately before its first use.
 * Zero-input plain plans have no semantic next state: `iteration.next` is
 * undefined. Source branching plans yield the selected transition's undefined
 * value after its required work, retaining the private slot and empty arity.
 * Multi-input plans pack simultaneous next values into one array expression;
 * the function's semantic inputs and public arity are unchanged.
 * Their normal result is still computed once after the final false test.
 */
export type PlainLoop = {
    readonly iteration: ScalarLoop
    readonly prefix: readonly Definition[]
    readonly resultPrefix: readonly Definition[]
    readonly result: Value
}
