/**
 * A JavaScript host for the `fjs:l1-native` imports that [the interface of
 * L1's native rows](../module.f.mjs) binds, beside the
 * [host of L0](../../l0/host/module.f.js), whose table of values it reads.
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
import { handles } from '../../l0/host/module.f.js'

/**
 * The `fjs:l1-native` imports over a table of values, the one that the host
 * of L0 reads.
 *
 * @type {(values: readonly unknown[]) => Host}
 */
export const host = values => {
    const value = handles(values)
    return {
        bigintEquals: (a, b) => bigintEquals(value(a), value(b)) ? 1 : 0,
        numberRemainder: (a, b) => numberRemainder(a, b),
    }
}
