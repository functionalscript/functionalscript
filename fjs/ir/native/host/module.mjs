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
 * `stringToNumber` and `bigintLess` answer a float.
 *
 * A kind mismatch throws as a WebAssembly trap would. A FunctionalScript
 * throw from a row — today `bigintDivide` or `bigintRemainder` of a zero divisor — is recorded
 * with `fail` the same way `Functions.call` keeps a throw, then rethrown so
 * the engine traps and the host reads it by `has_thrown` and `thrown`. So
 * is a bigint past the engine's size limit, which the engine throws as its
 * own `RangeError`, or past NaNVM's own limit, which is lower: the rows
 * that make a bigint record NaNVM's `bigintTooLarge` for it, as NaNVM's
 * own rows throw past its limit.
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
 * NaNVM's limit on a bigint's magnitude, in bits: 2^14 words of 64 bits
 * (`MAX_WORDS` in `nanvm/lib/src/vm/bigint/mod.rs`). A magnitude is past it
 * when it has a bit at or above this one.
 *
 * The bound is a bit count, not the bigint `1n << maxBits`: that one has
 * 2^20 + 1 bits, one more than Firefox lets a BigInt have, so making it
 * throws a `RangeError` when this module loads, and every page that
 * imports the module fails.
 */
const maxBits = 64n * (1n << 14n)

/** Whether a bigint is past NaNVM's limit. @type {(r: bigint) => boolean} */
const pastLimit = r => ((r < 0n ? -r : r) >> maxBits) !== 0n

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
export const host = (read, make, fail) => {
    /**
     * A row that makes a bigint, with the engine's own `RangeError` past
     * its size limit recorded and rethrown as NaNVM's `bigintTooLarge`,
     * and a FunctionalScript throw of division by zero recorded too.
     *
     * @type {(f: () => unknown) => bigint}
     */
    const sized = f => {
        try {
            const r = f()
            // NaNVM's limit, `MAX_WORDS` of `u64` words, is lower than an engine's, so a row past it throws here as on NaNVM.
            if (typeof r === 'bigint' && pastLimit(r)) { throw error.bigintTooLarge }
            return make(r)
        } catch (e) {
            const thrown = e instanceof RangeError ? error.bigintTooLarge : e
            if (thrown === error.divisionByZero || thrown === error.bigintTooLarge) { fail(thrown) }
            throw thrown
        }
    }
    return {
        bigintEquals: (a, b) => bigintEquals(read(a), read(b)) ? 1 : 0,
        numberRemainder: (a, b) => numberRemainder(a, b),
        numberShiftRight: (a, b) => numberShiftRight(a, b),
        numberAnd: (a, b) => numberAnd(a, b),
        numberToString: n => make(numberToString(n)),
        stringToNumber: s => stringToNumber(read(s)),
        stringToBigInt: s => sized(() => stringToBigInt(read(s))),
        bigintToString: b => make(bigintToString(read(b))),
        bigintAdd: (a, b) => sized(() => bigintAdd(read(a), read(b))),
        bigintSubtract: (a, b) => sized(() => bigintSubtract(read(a), read(b))),
        bigintMultiply: (a, b) => sized(() => bigintMultiply(read(a), read(b))),
        bigintDivide: (a, b) => sized(() => bigintDivide(read(a), read(b))),
        bigintNegate: a => make(bigintNegate(read(a))),
        bigintRemainder: (a, b) => sized(() => bigintRemainder(read(a), read(b))),
        bigintShiftRight: (a, b) => sized(() => bigintShiftRight(read(a), read(b))),
        bigintAnd: (a, b) => sized(() => bigintAnd(read(a), read(b))),
        bigintToNumber: b => bigintToNumber(read(b)),
        bigintLess: (a, b) => bigintLess(read(a), read(b)),
    }
}
