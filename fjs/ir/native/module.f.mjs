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
 *   on two numbers, which WASM has no instruction for. It takes and gives
 *   `f64`s, not values of `any`, so no number is boxed to cross.
 *
 * These are the rows that the slices read so far. Each joins with its first
 * caller.
 *
 * @module
 *
 * @import { Interface } from '../types.ts'
 */

import { any } from '../l0/module.f.js'
import { bool, f64, only, signature } from '../module.f.js'

/** A bigint. */
const bigint = only(any, 'bigint')

/** The interface of L1's native rows. @type {Interface} */
export const native = {
    abi: 'fjs:l1-native',
    types: [],
    functions: [
        ['bigintEquals', signature([['a', bigint], ['b', bigint]], bool)],
        ['numberRemainder', signature([['a', f64], ['b', f64]], f64)],
    ],
}
