/**
 * A JavaScript host for the `fjs:l1-native` imports that [the interface of
 * L1's native rows](../module.f.js) binds, beside the
 * [host of L0](../../l0/host/module.f.js), whose reading of handles it
 * shares.
 *
 * Each import is the [row](../../../wasm/runtime/l1/native/module.f.js)
 * itself, on the values that the handles name, or on the floats that come:
 * `bigintEquals` is its `bigintEquals` and `numberRemainder` its
 * `numberRemainder`. `numberToString` and `bigintToString` answer a handle
 * that `make` owns for the caller; so do the bigint arithmetic rows.
 * `stringToNumber`, `bigintToNumber` and `bigintLess` answer a float.
 *
 * A kind mismatch throws as a WebAssembly trap would. A FunctionalScript
 * throw from a row — today `bigintDivide` or `bigintRemainder` of a zero divisor — is recorded
 * with `fail` the same way `Functions.call` keeps a throw, then rethrown so
 * the engine traps and the host reads it by `has_thrown` and `thrown`.
 *
 * @module
 *
 * @import { Host } from './types.ts'
 */

import { error } from '../../../wasm/runtime/l1/error/module.f.js'
import {
    bigintAdd, bigintAnd, bigintDivide, bigintEquals, bigintLess, bigintMultiply, bigintNegate, bigintRemainder,
    bigintShiftRight, bigintSubtract, bigintToNumber, bigintToString, numberAnd, numberRemainder, numberShiftRight, numberToString,
    stringToBigInt, stringToNumber,
} from '../../../wasm/runtime/l1/native/module.f.js'

/**
 * The `fjs:l1-native` imports over a reading of handles, the one that the
 * host of L0 reads, `make`, which owns a cell of a value that a row
 * answers, and `fail`, which records a FunctionalScript throw the way the
 * counting host's `Functions.call` does.
 *
 * @type {(
 *   read: (h: bigint) => unknown,
 *   make: (value: unknown) => bigint,
 *   fail: (value: unknown) => void,
 * ) => Host}
 */
export const host = (read, make, fail) => ({
    bigintEquals: (a, b) => bigintEquals(read(a), read(b)) ? 1 : 0,
    numberRemainder: (a, b) => numberRemainder(a, b),
    numberShiftRight: (a, b) => numberShiftRight(a, b),
    numberAnd: (a, b) => numberAnd(a, b),
    numberToString: n => make(numberToString(n)),
    stringToNumber: s => stringToNumber(read(s)),
    stringToBigInt: s => make(stringToBigInt(read(s))),
    bigintToString: b => make(bigintToString(read(b))),
    bigintAdd: (a, b) => make(bigintAdd(read(a), read(b))),
    bigintSubtract: (a, b) => make(bigintSubtract(read(a), read(b))),
    bigintMultiply: (a, b) => make(bigintMultiply(read(a), read(b))),
    bigintDivide: (a, b) => {
        try {
            return make(bigintDivide(read(a), read(b)))
        } catch (e) {
            if (e === error.divisionByZero) { fail(e) }
            throw e
        }
    },
    bigintNegate: a => make(bigintNegate(read(a))),
    bigintRemainder: (a, b) => {
        try {
            return make(bigintRemainder(read(a), read(b)))
        } catch (e) {
            if (e === error.divisionByZero) { fail(e) }
            throw e
        }
    },
    bigintShiftRight: (a, b) => make(bigintShiftRight(read(a), read(b))),
    bigintAnd: (a, b) => make(bigintAnd(read(a), read(b))),
    bigintToNumber: b => bigintToNumber(read(b)),
    bigintLess: (a, b) => bigintLess(read(a), read(b)),
})
