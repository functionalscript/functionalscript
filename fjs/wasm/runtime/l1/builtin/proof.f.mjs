import { assert, assertEq } from '../../../../asserts/module.f.js'
import { entry as hostEntry, hasEntry as hostHasEntry } from '../../../../types/object/entry/module.f.js'
import { charCodeAt, entries, entry, fromCharCode, hasEntry, slice } from './module.f.js'

/** A function value. @type {(a: unknown) => unknown} */
const f = a => a

/** Strings with an empty one and a surrogate pair. */
const strings = ['', 'a', 'abc', '\u{1F600}x']

/** Positions and counts of every kind that converts to a number. */
const numbers = /** @type {readonly unknown[]} */ ([
    0, 1, 2, 3, -1, -2, -9, -0, 0.5, 1.9, -1.5, NaN, Infinity, -Infinity,
    '1', '', 'x', true, false, null, undefined, [1], [], { valueOf: () => 2 },
])

/** Whether two answers are the same, `NaN` and the zeros told apart. @type {(a: unknown, b: unknown) => boolean} */
const same = (a, b) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b) && typeof a === 'object'

/** Receivers of every kind but `undefined` and `null`. */
const receivers = /** @type {readonly unknown[]} */ ([
    [], [1, undefined, 'x'], '', 'ab', '\u{1F600}', {}, { a: 1, u: undefined, 0: 2 }, { 1: 'b', a: 2, 0: 'a' },
    0, 1, true, 0n, 1n, f,
])

/** Keys of every kind, canonical and not. */
const keys = /** @type {readonly unknown[]} */ ([
    0, 1, 2, -0, 1.5, -1, '0', '1', '01', '-1', 'a', 'u', 'length', '', [0], { toString: () => 'a' }, true, null, undefined,
])

export const proof = {
    // `charCodeAt` answers what the host's `charCodeAt` answers.
    charCodeAt: () => {
        for (const s of strings) {
            for (const at of numbers) {
                assert(Object.is(charCodeAt(s, at), s.charCodeAt(/** @type {number} */ (at))), `${s} ${String(at)}`)
            }
        }
    },
    // `slice` answers what the host's `slice` answers, `undefined` ends
    // included.
    slice: () => {
        for (const s of strings) {
            for (const start of numbers) {
                for (const end of numbers) {
                    const e = /** @type {number} */ (end)
                    assertEq(slice(s, start, end), s.slice(/** @type {number} */ (start), e), `${s} ${String(start)} ${String(end)}`)
                }
            }
        }
    },
    // `fromCharCode` answers what the host's `String.fromCharCode` answers,
    // for one argument of each kind, none, and several.
    fromCharCode: () => {
        const args = [
            [], [0x61, 0x62], [0xd83d, 0xde00], [0x1_0061], [-1], [-0x1_0000 - 1], [65535.9], [0x7fff_ffff * 4 + 3],
            ...numbers.map(n => [n]),
        ]
        for (const a of args) {
            assertEq(fromCharCode(a), String.fromCharCode(.../** @type {number[]} */ (a)), JSON.stringify(a))
        }
    },
    // `entries` answers what the host's `Object.entries` answers.
    entries: () => {
        for (const o of receivers) {
            assertEq(JSON.stringify(entries(o)), JSON.stringify(Object.entries(/** @type {object} */ (o))), String(o))
        }
    },
    // `entry` and `hasEntry` answer what the language's helpers answer.
    entry: () => {
        for (const o of receivers) {
            for (const k of keys) {
                const name = `${String(o)} ${String(k)}`
                assert(same(entry(o, k), hostEntry(o, k)), name)
                assertEq(hasEntry(o, k), hostHasEntry(o, k), name)
            }
        }
    },
    throw: {
        charCodeAtNotString: () => { charCodeAt(['a'], 0) },
        charCodeAtBigInt: () => { charCodeAt('a', 0n) },
        sliceNotString: () => { slice(1, 0, 1) },
        fromCharCodeNotArray: () => { fromCharCode(0x61) },
        fromCharCodeBigInt: () => { fromCharCode([1n]) },
        entriesUndefined: () => { entries(undefined) },
        entriesNull: () => { entries(null) },
        entryUndefined: () => { entry(undefined, 'a') },
        entryNull: () => { entry(null, 'a') },
        hasEntryNull: () => { hasEntry(null, 'a') },
        entryKey: () => { entry({}, { toString: () => ({}), valueOf: () => ({}) }) },
    },
}
