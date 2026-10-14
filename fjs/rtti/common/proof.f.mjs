/**
 * @import { Result } from '../../types/result/types.ts'
 * @import { Unknown } from '../ts/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Reader, ValidateE, ValidationError } from './types.ts'
 */

import {
    constContainerRead,
    containerRead,
    declaredTest,
    eachEntry,
    isArray,
    isObject,
    noAccumulate,
    noDeclared,
    restContainerRead,
    structSchemaEntries,
    tupleSchemaEntries,
    undeclaredMembers,
    verror,
} from './module.f.mjs'
import { option, or } from '../module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { assert, assertEq, assertErrorPath, assertOk, assertStructurallySame } from '../../asserts/module.f.mjs'

/** @type {(k: string, v: number) => Result<number, ValidationError>} */
const item = (k, v) =>
    v < 0 ? error({ path: [], message: `negative at ${k}` }) : ok(v * 2)

/** Mirrors `parse`'s accumulate step, kept simple (a small test list, not a `List`). */
/** @type {(acc: ReadonlyArray<readonly [string, number]>, k: string, v: number) => ReadonlyArray<readonly [string, number]>} */
const collect = (acc, k, v) => [...acc, [k, v]]

/**
 * A reader for the container skeletons that knows only primitive `Const`
 * schemas, matched with `Object.is`, and collects every member it reads in
 * order — so a proof sees exactly which members a skeleton read, and in what
 * order.
 *
 * @type {Reader<ReadonlyArray<readonly [string, Unknown]>>}
 */
const listing = {
    read: t => value => Object.is(t, value) ? ok(value) : verror('unexpected value'),
    empty: [],
    cons: (acc, k, v) => [...acc, [k, v]],
}

/** Answers with what the reader collected, ignoring the container. */
/** @type {(acc: ReadonlyArray<readonly [string, Unknown]>) => Unknown} */
const collected = acc => acc

/** Every length fits: what the struct kind and an admitting rest say. */
const anyLength = () => true

/** No length fits: what an empty element set says of a non-empty array. */
const noLength = () => false

/** Reads a tuple position. */
/** @type {(value: ReadonlyArray<Unknown>, k: string) => Unknown} */
const tupleItem = (value, k) => value[Number(k)]

/** Reads a struct member. */
/** @type {(value: StringMap<Unknown>, k: string) => Unknown} */
const structItem = (value, k) => value[k]

const arrayRead = containerRead(listing)(isArray, () => anyLength, collected)

const tupleRead = constContainerRead(listing)(isArray, tupleSchemaEntries, tupleItem, (value, declared) => value.length <= declared, collected)

const structRead = constContainerRead(listing)(isObject, structSchemaEntries, structItem, anyLength, collected)

const restStructRead = restContainerRead(listing)(isObject, structSchemaEntries, structItem, () => anyLength, collected)

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
        const r = eachEntry([['a', 1]], item, undefined, noAccumulate)
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
            const r = undeclaredMembers(declaredTest(['a']), { a: 1, b: 2 })
            assertStructurallySame(r, [['b', 2]])
        },
        // The positions come first, in index order, then the keys that name
        // none — so the reported error path is the leftmost failing member.
        tuple: () => {
            const r = undeclaredMembers(declaredTest(['0']), Object.assign([1, 2], { foo: 3, '01': 4 }))
            assertStructurallySame(r, [['1', 2], ['foo', 3], ['01', 4]])
        },
        none: () => assertEq(undeclaredMembers(declaredTest(['a']), { a: 1 }).length, 0),
        // A uniform container declares nothing, so every member is undeclared.
        every: () => {
            const r = undeclaredMembers(noDeclared, { a: 1, b: 2 })
            assertStructurallySame(r, [['a', 1], ['b', 2]])
        },
        // A hole is no member, so it meets no `rest` — which is why the array
        // kind also answers with its `length`; see `fits` in
        // `../parse/module.f.mjs`.
        holeIsNoMember: () => assertEq(undeclaredMembers(declaredTest(['0']), [1, , 3]).length, 1),
        // The walk is bounded by what the value and its prototypes carry, not
        // by `length` — this one carries a single own property, `length`, so
        // it answers at once. Materializing the range instead exhausted memory
        // long before any check could reject the value.
        lengthDoesNotBoundTheWalk: () =>
            assertEq(undeclaredMembers(noDeclared, new Array(2 ** 32 - 1)).length, 0),
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
    // The three container skeletons, read with `listing`, which shows what
    // each one read and collected. The acceptance tables in
    // `../validate/proof.f.mjs` hold `validate` and `parse` to them through
    // the readers; these hold the skeletons to their own contracts.
    containerRead: {
        // Every member is read and collected, in member order.
        collects: () => assertStructurallySame(
            assertOk(arrayRead(1)([1, 1])),
            [['0', 1], ['1', 1]],
        ),
        // The first bad member answers, under its key.
        memberError: () => assertErrorPath(['1'])(arrayRead(1)([1, 2])),
        notAContainer: () => assertErrorPath([])(arrayRead(1)({})),
        // With no member to read, `restFits` decides — and `finish` is handed
        // the container — and the item reader is never instantiated, which is
        // what lets a recursive schema stop at an empty container.
        empty: () => {
            let reads = 0
            /** @type {typeof listing} */
            const counting = { ...listing, read: t => { reads += 1; return listing.read(t) } }
            const empty = /** @type {const} */ ([])
            /** @type {(acc: unknown, value: Unknown) => Unknown} */
            const keep = (_, value) => value
            assert(Object.is(assertOk(containerRead(counting)(isArray, () => anyLength, keep)(1)(empty)), empty))
            assertErrorPath([])(containerRead(counting)(isArray, () => noLength, keep)(1)(empty))
            assertEq(reads, 0)
        },
    },
    constContainerRead: {
        // An absent member its schema admits is legal, and collected by
        // nothing, so a rebuild omits it rather than materializing it.
        absentIsNotCollected: () => assertStructurallySame(
            assertOk(structRead({ a: 1, b: or(option, 2) })({ a: 1 })),
            [['a', 1]],
        ),
        memberError: () => assertErrorPath(['0'])(tupleRead([1])([2])),
        notAContainer: () => assertErrorPath([])(structRead({ a: 1 })(1)),
        // The shape is settled before any member is read, cheapest question
        // first: the bound, then an illegal absence, then an undeclared
        // member — each answering ahead of a bad member it would otherwise
        // have to read past.
        shapeFirst: () => {
            assertErrorPath([])(tupleRead([1])([2, 1]))
            assertErrorPath(['1'])(tupleRead([1, 1])([2]))
            assertErrorPath([])(structRead({ a: 1 })({ a: 2, b: 1 }))
            assertErrorPath(['a'])(structRead({ a: 1 })({ b: 1 }))
        },
    },
    restContainerRead: {
        // The declared members are read **first**, absence included, and only
        // then are the leftovers held to the rest: a value failing both ways
        // reports its declared member. A leftovers-first skeleton would
        // report `b` here.
        declaredFirst: () => {
            assertErrorPath(['a'])(restStructRead({ a: 1 }, 2)({ a: 3, b: 4 }))
            assertErrorPath(['a'])(restStructRead({ a: 1 }, 2)({ b: 4 }))
        },
        leftoverIsHeldToTheRest: () => assertErrorPath(['b'])(restStructRead({ a: 1 }, 2)({ a: 1, b: 4 })),
        // A leftover that passes, and an absent member, are collected by
        // nothing.
        collectsDeclaredOnly: () => assertStructurallySame(
            assertOk(restStructRead({ a: 1, c: or(option, 3) }, 2)({ a: 1, b: 2 })),
            [['a', 1]],
        ),
        notAContainer: () => assertErrorPath([])(restStructRead({ a: 1 }, 2)(1)),
        // With nothing past the prefix, `restFits` decides.
        nothingPastThePrefix: () => {
            /** @type {(fits: () => boolean) => ValidateE} */
            const read = fits => restContainerRead(listing)(isArray, tupleSchemaEntries, tupleItem, () => fits, collected)([1], 2)
            assertOk(read(anyLength)([1]))
            assertErrorPath([])(read(noLength)([1]))
        },
    },
}
