/**
 * @import { Result } from '../../result/types.ts'
 * @import { ValidationError } from './types.ts'
 */

import { eachEntry, undeclaredEntries } from './module.f.mjs'
import { error, ok } from '../../result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.mjs'

/** @typedef {ReadonlyArray<readonly [string, number]>} _Entries */

/** @type {(k: string, v: number) => Result<number, ValidationError>} */
const item = (k, v) =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

/** Mirrors `parse`'s accumulate step, kept simple (a small test list, not a `List`). */
/** @type {(acc: _Entries, k: string, v: number) => _Entries} */
const collect = (acc, k, v) => [...acc, [k, v]]

export const proof = {
    empty: () => {
        const r = eachEntry([], item, [], collect)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 0)
    },
    allOk: () => {
        const r = eachEntry([['a', 1], ['b', 2]], item, [], collect)
        assert(r[0] === 'ok')
        assertEq(r[1].length, 2)
        assertEq(r[1][0][0], 'a')
        assertEq(r[1][0][1], 2)
        assertEq(r[1][1][0], 'b')
        assertEq(r[1][1][1], 4)
    },
    // Mirrors `validate`'s usage: nothing is collected, only pass/fail matters.
    noAccumulate: () => {
        const r = eachEntry([['a', 1]], item, undefined, () => undefined)
        assert(r[0] === 'ok')
        assertEq(r[1], undefined)
    },
    firstErrorWins: () => {
        const r = eachEntry([['a', -1], ['b', -2]], item, [], collect)
        assert(r[0] === 'error')
        assertEq(r[1].message, 'negative at a')
    },
    shortCircuits: () => {
        let calls = 0
        /** @type {(k: string, v: number) => Result<number, ValidationError>} */
        const counting = (k, v) => {
            calls++
            return item(k, v)
        }
        const r = eachEntry([['a', -1], ['b', -2], ['c', -3]], counting, [], collect)
        assert(r[0] === 'error')
        assertEq(calls, 1)
    },
    // The other half of a closed container's loop. One filter answers both
    // kinds: a struct's undeclared keys, and — a tuple's declared keys being
    // the canonical spellings of its positions — an array's positions past the
    // prefix together with the keys that are no position at all.
    undeclared: {
        struct: () => {
            const r = undeclaredEntries(['a'], { a: 1, b: 2 })
            assertStructurallySame(r, [['b', 2]])
        },
        tuple: () => {
            const r = undeclaredEntries(['0'], Object.assign([1, 2], { foo: 3, '01': 4 }))
            assertStructurallySame(r, [['1', 2], ['foo', 3], ['01', 4]])
        },
        none: () => assertEq(undeclaredEntries(['a'], { a: 1 }).length, 0),
        // A hole is no entry, which is why the array kind also answers with its
        // length — see `fits` in `../parse/module.f.mjs`.
        holeIsNotAnEntry: () => assertEq(undeclaredEntries(['0'], [1, , 3]).length, 1),
    },
    pathPrefixed: () => {
        /** @type {(k: string, v: number) => Result<number, ValidationError>} */
        const nested = (k, v) =>
            v < 0 ? error({ path: ['inner'], message: 'bad' }) : ok(v)
        const r = eachEntry([['outer', -1]], nested, [], collect)
        assert(r[0] === 'error')
        assertEq(r[1].path.length, 2)
        assertEq(r[1].path[0], 'outer')
        assertEq(r[1].path[1], 'inner')
    },
}
