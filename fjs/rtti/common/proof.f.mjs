/**
 * @import { Result } from '../../types/result/types.ts'
 * @import { ValidationError } from './types.ts'
 */

import { eachEntry, structSchemaEntries, tupleSchemaEntries, undeclaredMembers } from './module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(k: string, v: number) => Result<number, ValidationError>} */
const item = (k, v) =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

/** Mirrors `parse`'s accumulate step, kept simple (a small test list, not a `List`). */
/** @type {(acc: ReadonlyArray<readonly [string, number]>, k: string, v: number) => ReadonlyArray<readonly [string, number]>} */
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
    // The other half of a container's loop: the members a bare schema rejects
    // and a `rest` one holds to its rest. One function answers both kinds — a
    // struct's undeclared own keys, and an array's positions past the prefix
    // together with the own keys that are no position at all.
    undeclared: {
        struct: () => {
            const r = undeclaredMembers(['a'], { a: 1, b: 2 })
            assertStructurallySame(r, [['b', 2]])
        },
        // The positions come first, in index order, then the keys that name
        // none — so the reported error path is the leftmost failing member.
        tuple: () => {
            const r = undeclaredMembers(['0'], Object.assign([1, 2], { foo: 3, '01': 4 }))
            assertStructurallySame(r, [['1', 2], ['foo', 3], ['01', 4]])
        },
        none: () => assertEq(undeclaredMembers(['a'], { a: 1 }).length, 0),
        // A hole is no member, so it meets no `rest` — which is why the array
        // kind also answers with its `length`; see `fits` in
        // `../parse/module.f.mjs`.
        holeIsNoMember: () => assertEq(undeclaredMembers(['0'], [1, , 3]).length, 1),
        // The walk is bounded by what the value and its prototypes carry, not
        // by `length` — this one carries a single own property, `length`, so
        // it answers at once. Materializing the range instead exhausted memory
        // long before any check could reject the value.
        lengthDoesNotBoundTheWalk: () =>
            assertEq(undeclaredMembers([], new Array(2 ** 32 - 1)).length, 0),
    },
    // What a container schema declares, per kind. A tuple is read by length,
    // so a hole is a declared position whose schema is `undefined` — the same
    // reading `../data/module.f.mjs` has, and the reason the two kinds need
    // different entry readers at all.
    schemaEntries: {
        tuple: () => assertStructurallySame(
            tupleSchemaEntries([1, 'a']),
            [['0', 1], ['1', 'a']],
        ),
        // `Object.entries` would answer `[]` here, and `[['0', undefined]]` for
        // `[undefined]` — two schemas that denote the same set, read as two.
        tupleHole: () => assertStructurallySame(
            tupleSchemaEntries(new Array(1)),
            [['0', undefined]],
        ),
        tupleHoleIsTheDenseReading: () => assertStructurallySame(
            tupleSchemaEntries(new Array(1)),
            tupleSchemaEntries([undefined]),
        ),
        struct: () => assertStructurallySame(
            structSchemaEntries({ a: 1, b: 'x' }),
            [['a', 1], ['b', 'x']],
        ),
        empty: () => {
            assertEq(tupleSchemaEntries([]).length, 0)
            assertEq(structSchemaEntries({}).length, 0)
        },
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
