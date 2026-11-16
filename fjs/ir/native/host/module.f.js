/**
 * A JavaScript host for the `fjs:l1-native` imports that [the interface of
 * L1's native rows](../module.f.js) binds, beside the
 * [host of L0](../../l0/host/module.f.js), whose reading of handles it
 * shares.
 *
 * Each import is the [row](../../../wasm/runtime/l1/native/module.f.js)
 * itself, on the values that the handles name, or on the floats that come:
 * `bigintEquals` is its `bigintEquals` and `numberRemainder` its
 * `numberRemainder`. `numberToString` takes a float and answers a handle
 * that `make` owns for the caller. Where the row throws, as where WASM
 * would trap, so does the import.
 *
 * @module
 *
 * @import { Host } from './types.ts'
 */

import { bigintEquals, numberRemainder, numberToString } from '../../../wasm/runtime/l1/native/module.f.js'

/**
 * The `fjs:l1-native` imports over a reading of handles, the one that the
 * host of L0 reads, and `make`, which owns a cell of a value that a row
 * answers.
 *
 * @type {(read: (h: bigint) => unknown, make: (value: unknown) => bigint) => Host}
 */
export const host = (read, make) => ({
    bigintEquals: (a, b) => bigintEquals(read(a), read(b)) ? 1 : 0,
    numberRemainder: (a, b) => numberRemainder(a, b),
    numberToString: n => make(numberToString(n)),
})
