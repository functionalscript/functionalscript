/**
 * Implementation-private types for the big-float module.
 */

import type { BigFloat } from './types.ts'

/**
 * A magnitude that has been truncated, paired with what was cut off: the exact
 * value is `m * 2^e` when `r` is `0n`, and strictly between `m * 2^e` and
 * `(m + 1) * 2^e` otherwise. Only `r === 0n` is ever asked, so any non-zero
 * `r` — a division remainder, the bits a shift dropped, or both — says the
 * same thing.
 */
export type _BigFloatWithRemainder = readonly [BigFloat, bigint]
