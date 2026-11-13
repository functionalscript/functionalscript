/**
 * Array repetition through the concatenation monoid, without list dependencies.
 *
 * @module
 * @import { FixedArray } from '../types.ts'
 */

import { repeat as monoidRepeat } from '../../../common/monoid/repeat/module.f.js'
import { bigint } from '../../bigint/from_number/module.f.js'

/** Array concatenation in operand order. @type {<T>(a: readonly T[]) => (b: readonly T[]) => readonly T[]} */
const concat = a => b => [...a, ...b]

/**
 * Repeats a singleton array under concatenation using monoid doubling.
 * Nonpositive counts give an empty array; positive fractional counts round up.
 * `NaN` and positive infinity throw. Each application creates a fresh array,
 * and repeated object elements retain their identity.
 *
 * @type {<N extends number>(n: N) => <T>(value: T) => FixedArray<N, T>}
 */
export const repeat = n => {
    const rest = n % 1
    const count = bigint(n <= 0 ? 0 : rest === 0 ? n : n - rest + 1)
    return value => /** @type {FixedArray<typeof n, typeof value>} */ (monoidRepeat({
        identity: /** @type {readonly (typeof value)[]} */ ([]),
        operation: concat,
    })(count)([value]))
}
