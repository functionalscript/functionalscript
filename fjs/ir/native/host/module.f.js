/**
 * A JavaScript host for the `fjs:l1-native` imports that [the interface of
 * L1's native rows](../module.f.js) binds, beside the
 * [host of L0](../../l0/host/module.f.js), whose reading of handles it
 * shares.
 *
 * Each import is the [row](../../../wasm/runtime/l1/native/module.f.js)
 * itself, on the values that the handles name, or on the floats that come:
 * `bigintEquals` is its `bigintEquals` and `numberRemainder` its
 * `numberRemainder`. Where the row throws, as where WASM would trap, so
 * does the import.
 *
 * @module
 *
 * @import { Host } from './types.ts'
 */

import { bigintEquals, numberRemainder } from '../../../wasm/runtime/l1/native/module.f.js'

/**
 * The `fjs:l1-native` imports over a reading of handles, the one that the
 * host of L0 reads.
 *
 * @type {(read: (h: bigint) => unknown) => Host}
 */
export const host = read => ({
    bigintEquals: (a, b) => bigintEquals(read(a), read(b)) ? 1 : 0,
    numberRemainder: (a, b) => numberRemainder(a, b),
})
