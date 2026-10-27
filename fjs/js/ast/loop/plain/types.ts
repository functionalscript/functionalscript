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
 */
export type PlainLoop = {
    readonly iteration: ScalarLoop
    readonly prefix: readonly Definition[]
    readonly resultPrefix: readonly Definition[]
    readonly result: Value
}
