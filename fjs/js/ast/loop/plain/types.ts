/**
 * Type-level API of normalized plain FAST loop planning.
 *
 * @module
 */

import type { Definition, Value } from '../../types.ts'
import type { ScalarLoop } from '../types.ts'

/**
 * The condition keeps its complete required prefix. Other regions duplicate
 * only the identity-free prefix dependencies they actually read.
 */
export type PlainLoop = {
    readonly iteration: ScalarLoop
    readonly prefix: readonly Definition[]
    readonly stepPrefix: readonly Definition[]
    readonly resultPrefix: readonly Definition[]
    readonly result: Value
}
