/**
 * Host proofs of the L1-native adapter: each import row on a handle table.
 * The adapter is plain host JavaScript (`module.mjs`) because
 * `bigintDivide` of zero records a FunctionalScript throw via `fail` before
 * rethrowing — `try`/`catch` that FunctionalScript cannot express.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 */

import { assert, assertEq } from '../../../asserts/module.f.js'
import { handles } from '../../l0/host/module.f.js'
import { error } from '../../../wasm/runtime/l1/error/module.f.js'
import { host } from './module.mjs'

/** Bigints, one past a word, zero, and a value of another kind. */
const values = [1n, 1n, -1n, 1n << 64n, 0n, 1 << 30, 'a']

/** @type {unknown[]} */
const owned = []
const h = host(handles(values), value => {
    const i = BigInt(values.length + owned.length)
    owned.push(value)
    return i
}, () => {})

export const proof = {
    // A handle names a value of the table, and each import is its row on the values or the floats.
    bigintEquals: () => {
        assertEq(h.bigintEquals(0n, 1n), 1)
        assertEq(h.bigintEquals(0n, 2n), 0)
        assertEq(h.bigintEquals(3n, 3n), 1)
    },
    numberRemainder: () => {
        assertEq(h.numberRemainder(5.5, 2), 1.5)
        assertEq(h.numberRemainder(-7, 2), -1)
    },
    // numberToString owns a cell of the decimal spelling of a float.
    numberToString: () => {
        const k = h.numberToString(10)
        assertEq(owned[Number(k) - values.length], '10')
    },
    stringToNumber: () => assert(Number.isNaN(h.stringToNumber(6n))),
    bigintToString: () => {
        const k = h.bigintToString(0n)
        assertEq(owned[Number(k) - values.length], '1')
    },
    // Bigint arithmetic owns a cell of the answer; bigintLess answers a float.
    bigintAdd: () => {
        const k = h.bigintAdd(0n, 3n)
        assertEq(owned[Number(k) - values.length], 1n + (1n << 64n))
    },
    bigintSubtract: () => {
        const k = h.bigintSubtract(0n, 2n)
        assertEq(owned[Number(k) - values.length], 2n)
    },
    bigintMultiply: () => {
        const k = h.bigintMultiply(0n, 0n)
        assertEq(owned[Number(k) - values.length], 1n)
    },
    bigintDivide: () => {
        const k = h.bigintDivide(3n, 0n)
        assertEq(owned[Number(k) - values.length], 1n << 64n)
    },
    bigintNegate: () => {
        const k = h.bigintNegate(0n)
        assertEq(owned[Number(k) - values.length], -1n)
    },
    numberBits: () => {
        assertEq(h.numberShiftRight(-9, 1), -5)
        assertEq(h.numberAnd(6, 3), 2)
    },
    bigintRemainder: () => {
        const k = h.bigintRemainder(3n, 0n)
        assertEq(owned[Number(k) - values.length], 0n)
    },
    bigintShiftRight: () => {
        const k = h.bigintShiftRight(3n, 0n)
        assertEq(owned[Number(k) - values.length], 1n << 63n)
    },
    bigintAnd: () => {
        const k = h.bigintAnd(2n, 3n)
        assertEq(owned[Number(k) - values.length], 1n << 64n)
    },
    bigintLess: () => {
        assertEq(h.bigintLess(0n, 3n), 1)
        assertEq(h.bigintLess(3n, 0n), 0)
    },
    // Division by zero and a bigint past the engine's size limit are FunctionalScript throws, which `fail` records before the rethrow.
    recorded: () => {
        /** @type {unknown[]} */
        const failed = []
        const r = host(handles([1n, 0n, -(1n << 40n)]), () => 0n, e => { failed.push(e) })
        /** @type {(f: () => unknown) => unknown} */
        const thrown = f => {
            try {
                f()
            } catch (e) {
                return e
            }
            return undefined
        }
        assertEq(thrown(() => r.bigintShiftRight(0n, 2n)), error.bigintTooLarge)
        assertEq(thrown(() => r.bigintDivide(0n, 1n)), error.divisionByZero)
        // Past NaNVM's limit of 2^14 words, which is under the engine's.
        const s = host(handles([1n, -(64n << 14n), 1n - (64n << 14n)]), () => 0n, e => { failed.push(e) })
        assertEq(thrown(() => s.bigintShiftRight(0n, 1n)), error.bigintTooLarge)
        assertEq(thrown(() => s.bigintShiftRight(0n, 2n)), undefined)
        assertEq(thrown(() => r.bigintEquals(0n, 5n)) === undefined, false)
        assertEq(failed.length, 3)
        assertEq(failed[0], error.bigintTooLarge)
        assertEq(failed[1], error.divisionByZero)
        assertEq(failed[2], error.bigintTooLarge)
    },
    // Kind mismatch traps; division by zero is a FunctionalScript throw (fail records it when wired).
    throw: {
        notBigint: () => { h.bigintEquals(0n, 5n) },
        notHandle: () => { h.bigintEquals(0n, 7n) },
        stringToNumber: () => { h.stringToNumber(0n) },
        bigintToString: () => { h.bigintToString(5n) },
        bigintDivideZero: () => { h.bigintDivide(0n, 4n) },
        bigintRemainderZero: () => { h.bigintRemainder(0n, 4n) },
        bigintLessNoBigint: () => { h.bigintLess(5n, 6n) },
    },
}
