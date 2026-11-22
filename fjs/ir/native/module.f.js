/**
 * The interface of L1's [native rows](../../wasm/runtime/l1/native/module.f.js)
 * as data: what a module of the [IR](../README.md) needs to know of the rows
 * of L1 that have no FunctionalScript body. A host binds them to the
 * `fjs:l1-native` imports, as
 * [l1-design.md](../../../doc/sasha-gil/wasm/l1-design.md#linking-and-substitution)
 * links them, and [`host`](./host/module.f.js) provides them on a JavaScript
 * host.
 *
 * - **A row's parameters take what its body checks.** `bigintEquals` takes
 *   two bigints, so a module casts a value of unknown kind first, as it does
 *   for L0's `to_f64`. Its values of `any` are sealed by
 *   [L0's Any](../l0/module.f.js), which a module that imports this
 *   imports too.
 * - **A row of numbers takes and gives floats.** `numberRemainder` is `%`
 *   on two numbers, which WASM has no instruction for, and
 *   `numberShiftRight` and `numberAnd` are `>>` and `&`, which read each
 *   number as a 32-bit integer. They take and give `f64`s, not values of
 *   `any`, so no number is boxed to cross.
 * - **`numberToString` takes a float and answers an owned string**, the
 *   decimal spelling of the float, which object spread uses as an index
 *   key. The caller owns the string, as it owns what L0 makes.
 * - **`stringToNumber` takes a string and answers a float**, the number its
 *   text spells. **`bigintToString` takes a bigint and answers an owned
 *   string**, its decimal spelling. Both join with L1's coercions.
 * - **Bigint arithmetic** takes and answers bigints: `bigintAdd`,
 *   `bigintSubtract`, `bigintMultiply`, `bigintShiftRight` and
 *   `bigintAnd` (which may fail past NaNVM's size limit),
 *   `bigintDivide` and `bigintRemainder` (which may fail on a zero
 *   divisor), and `bigintNegate`. **`bigintToNumber`** takes a bigint and
 *   answers its nearest float, for `Number(...)`. **`bigintLess`** takes two values
 *   of `any` (a bigint, number or string each) and answers a float,
 *   `1` / `0` / `-1`, for L1's mixed bigint comparisons.
 *
 * These are the rows that the slices read so far. Each joins with its first
 * caller.
 *
 * @module
 *
 * @import { Interface } from '../types.ts'
 */

import { any, string } from '../l0/module.f.js'
import { bool, f64, mayFail, only, signature } from '../module.f.js'

/** A bigint. */
const bigint = only(any, 'bigint')

const big2 = /** @type {const} */ ([['a', bigint], ['b', bigint]])

/** The interface of L1's native rows. @type {Interface} */
export const native = {
    abi: 'fjs:l1-native',
    types: [],
    functions: [
        ['bigintEquals', signature(big2, bool)],
        ['numberRemainder', signature([['a', f64], ['b', f64]], f64)],
        ['numberShiftRight', signature([['a', f64], ['b', f64]], f64)],
        ['numberAnd', signature([['a', f64], ['b', f64]], f64)],
        ['numberToString', signature([['n', f64]], string)],
        ['stringToNumber', signature([['s', string]], f64)],
        ['bigintToString', signature([['b', bigint]], string)],
        ['bigintAdd', mayFail(signature(big2, bigint))],
        ['bigintSubtract', mayFail(signature(big2, bigint))],
        ['bigintMultiply', mayFail(signature(big2, bigint))],
        ['bigintDivide', mayFail(signature(big2, bigint))],
        ['bigintNegate', signature([['a', bigint]], bigint)],
        ['bigintRemainder', mayFail(signature(big2, bigint))],
        ['bigintShiftRight', mayFail(signature(big2, bigint))],
        ['bigintAnd', mayFail(signature(big2, bigint))],
        ['bigintToNumber', signature([['b', bigint]], f64)],
        ['bigintLess', signature([['a', any], ['b', any]], f64)],
    ],
}
