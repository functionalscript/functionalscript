/**
 * The rtti readers against values **FunctionalScript cannot build**.
 *
 * A `proof.mjs` rather than a `proof.f.mjs`, and deliberately: the fixtures
 * here need in-place mutation — `Object.setPrototypeOf` to give an array a
 * prototype that supplies an index, `Object.assign` to put a key past the
 * index range on one — which [`../AGENTS.md`](../AGENTS.md) §3.1 forbids
 * in authored FunctionalScript. `shouldLoad` in
 * [`../dev/module.f.mjs`](../dev/module.f.mjs) makes a plain
 * `proof.mjs` the opt-in home for exactly that, so the mutation stays out of
 * the `.f.mjs` proofs rather than being smuggled through them.
 *
 * The values are worth pinning even though the subset cannot express them: a
 * caller in ordinary JavaScript can hand one to an exported reader, and both
 * are cases where reading a member by *entry* and reading it by *index*
 * disagree — which is what these readers had wrong.
 *
 * @module
 *
 * @import { Type } from './types.ts'
 * @import { ValidateE } from './common/types.ts'
 * @import { Unknown } from './ts/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { undeclaredMembers } from './common/module.f.mjs'
import { toData, validate as dataValidate } from './data/module.f.mjs'
import { array, number, option, or, rest, string } from './module.f.mjs'
import { parse } from './parse/module.f.mjs'
import { validate } from './validate/module.f.mjs'

/** The three readers with their payload type erased, as `validate/proof.f.mjs` has them. */

/** @type {(t: Type) => ValidateE} */
const v = t => /** @type {any} */ (validate(t))

/** @type {(t: Type) => ValidateE} */
const p = t => /** @type {any} */ (parse(t))

/** @type {(t: Type) => ValidateE} */
const d = t => dataValidate(toData(t))

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/** @type {(r: readonly [string, unknown]) => void} */
const assertError = ([k]) => { assertEq(k, 'error', 'expected error') }

/**
 * An array whose index 1 is readable through the **prototype**: `length` says
 * 2, index 1 is no own entry, and reading it gives `99`. `Array.isArray` looks
 * at the value and not at its prototype, so this is still an array to every
 * reader — and the member is one a schema has to answer for, or the tail
 * `./ts/types.ts` renders would claim the rest's type over a number.
 *
 * @type {() => readonly Unknown[]}
 */
const inheritedIndex = () => {
    const value = [42, ,]
    Object.setPrototypeOf(value, [0, 99])
    return value
}

/**
 * An array whose prototype supplies an index it **owns anyway**. Nothing about
 * it is unusual to a reader — the member list is the own one — but it is the
 * case that separates "the chain names an index" from "the chain supplies one",
 * which is where the walk decides whether it has anything to merge.
 *
 * @type {() => readonly Unknown[]}
 */
const shadowedIndex = () => {
    const value = [42]
    Object.setPrototypeOf(value, [7])
    return value
}

/**
 * An array carrying `4294967295` — one past the last index the language has.
 * Assigning it creates an ordinary enumerable property and leaves `length` at
 * `1`, so it is an undeclared member that no `length`-bounded walk reaches; a
 * reader treating it as an index found it on neither path and let it through a
 * closed container.
 *
 * @type {() => readonly Unknown[]}
 */
const beyondIndexRange = () => Object.assign([1], { '4294967295': 2 })

export const proof = {
    // `undeclaredMembers` decides a container's members by what an index
    // *reads*, so both of these are members — one that an own-entry walk
    // misses, and one that an index-keyed walk misses.
    undeclaredMembers: {
        inheritedIndexIsAMember: () => {
            const value = inheritedIndex()
            assertEq(value.length, 2, 'the array reaches that far')
            assert(!Object.hasOwn(value, 1), 'and index 1 is no own entry')
            assertStructurallySame(undeclaredMembers(['0'], value), [['1', 99]])
        },
        // A shadowed one contributes nothing: the value owns the index, so
        // the member list is what the own walk already answered.
        shadowedIndexIsTheOwnOne: () => {
            const value = shadowedIndex()
            assertEq(value[0], 42, 'the own value wins')
            assertStructurallySame(undeclaredMembers([], value), [['0', 42]])
            assertEq(undeclaredMembers(['0'], value).length, 0)
        },
        // `2 ** 32 - 1` is not an index: assigning it creates an ordinary
        // enumerable property and leaves `length` alone, so it is a member by
        // the non-index half. Reading it as an index put it past both halves.
        beyondTheIndexRangeIsAMember: () => {
            const value = beyondIndexRange()
            assertEq(value.length, 1, '`length` never saw the assignment')
            assertStructurallySame(
                undeclaredMembers(['0'], value),
                [['4294967295', 2]],
            )
        },
    },
    // Every row runs through all three readers, which is the agreement
    // `validate/proof.f.mjs`'s table exists to hold: a value one reader
    // accepts and another rejects is a bug in whichever walk differs, and
    // both of these fixtures found one.
    readersAgree: () => {
        /** @type {readonly (readonly [Type, readonly Unknown[]])[]} */
        const rows = [
            // an index read through the prototype is held to the rest like any
            // other member — on the uniform reader as well as the tuple one
            [rest([number], string), inheritedIndex()],
            [rest([number], number), inheritedIndex()],
            [array(string), inheritedIndex()],
            [array(number), inheritedIndex()],
            // a key past the last index the language has is an ordinary
            // property, so it is a member by the non-index half
            [[number], beyondIndexRange()],
            [rest([number], string), beyondIndexRange()],
            [rest([number], number), beyondIndexRange()],
        ]
        for (const [t, value] of rows) {
            const rv = v(t)(value)
            assertEq(rv[0], p(t)(value)[0], 'validate and parse must agree')
            assertEq(rv[0], d(t)(value)[0], 'the data form must agree too')
        }
    },
    // …and what they agree on, which is what the changelog entry claims.
    inheritedIndexMeetsTheRest: () => {
        const value = inheritedIndex()
        for (const read of [v, p, d]) {
            assertError(read(rest([number], string))(value))
            assertOk(read(rest([number], number))(value))
            // `array(t)` is `rest([], t)`, so it walks the value the same way.
            // An own-entry walk here answered `ok` while the data form's
            // reader rejected the same value against the same schema.
            assertError(read(array(string))(value))
            assertOk(read(array(number))(value))
        }
        assert(Object.is(v(rest([number], number))(value)[1], value),
            '`validate` still hands back the value it was given')
    },
    beyondTheIndexRangeIsAMember: () => {
        const value = beyondIndexRange()
        for (const read of [v, p, d]) {
            // a bare container names every member it admits, and not this one
            assertError(read([number])(value))
            // a stated rest answers for it like any other undeclared member
            assertError(read(rest([number], string))(value))
            assertOk(read(rest([number], number))(value))
        }
    },
    // A declared member absent by own-key but supplied by the **prototype** is
    // present to the readers — HasProperty, the same test `getItem`'s read
    // answers to — so the inherited value must satisfy the member's present
    // part: `or(option, t)`'s `option` branch rejects any present value, so
    // dispatching the read value *is* the present-part check. Without it,
    // `validate` would hand back an object whose `.a` reads `'bad'` while the
    // rendered type promises `number` — the own-key rule alone would have
    // introduced that unsoundness, not inherited it.
    inheritedDeclaredMemberMeetsThePresentPart: () => {
        const value = Object.create({ a: 'bad' })
        for (const read of [v, p, d]) {
            assertError(read({ a: or(option, number) })(value))
            assertOk(read({ a: or(option, string) })(value))
        }
    },
    // `parse`'s tuple rebuild never runs a method of the value: it is built
    // from the parsed entries alone, on trusted plain arrays. An accepted
    // `Array` subclass — or, as here, an array whose prototype supplies the
    // methods — can override `slice`/`map`; a rebuild that called them was
    // handed `['ok', []]` for an input holding `1`, a result that fails the
    // very schema it was parsed against, and a throwing override escaped
    // the `Result` API entirely.
    hostileArrayMethodsDoNotReachTheRebuild: () => {
        const value = [1]
        Object.setPrototypeOf(value, Object.assign([], {
            slice: () => [],
            map: () => { throw 'hostile' },
        }))
        const r = p([number])(value)
        assert(r[0] === 'ok', 'expected ok')
        assertStructurallySame(/** @type {readonly unknown[]} */ (r[1]), [1])
    },
    // …and never dispatches an overridable operation at all. Reading a
    // member can run arbitrary code — an accessor — and the rebuild runs
    // after every read, so a getter that patches `Array.prototype.concat`
    // (or `map`, `flatMap`, `slice`, `Object.fromEntries`) has patched it
    // before any rebuild executes: a rebuild dispatching one of them was
    // handed `['ok', []]` for `[1, 2]` against `[number, number]`. The
    // fixed rebuilds construct with `defineProperty` captured at module
    // load and walk their own cons list by property reads, so none of
    // these patches reaches what `parse` builds. (The *verdict* path still
    // dispatches overridable operations after a read — that exposure is
    // `todo/hostile-accessor-hermetic-read-path.md`, and this fixture
    // patches only what corrupts no verdict here.)
    hostileIntrinsicPatchesDoNotReachTheRebuild: () => {
        const captured = {
            concat: Array.prototype.concat,
            flatMap: Array.prototype.flatMap,
            map: Array.prototype.map,
            slice: Array.prototype.slice,
            fromEntries: Object.fromEntries,
        }
        const patch = () => {
            Array.prototype.concat = () => []
            Array.prototype.flatMap = () => []
            Array.prototype.map = () => []
            Array.prototype.slice = () => []
            Object.fromEntries = () => ({})
        }
        const restore = () => {
            Array.prototype.concat = captured.concat
            Array.prototype.flatMap = captured.flatMap
            Array.prototype.map = captured.map
            Array.prototype.slice = captured.slice
            Object.fromEntries = captured.fromEntries
        }
        /** @type {(v: Unknown) => () => Unknown} */
        const patchingGetter = v => () => { patch(); return v }
        // The original repro: an index-0 getter that patches and returns `1`.
        const tupleValue = [0, 2]
        Object.defineProperty(tupleValue, 0, {
            get: patchingGetter(1),
            enumerable: true,
            configurable: true,
        })
        const rt = p([number, number])(tupleValue)
        restore()
        assert(rt[0] === 'ok', 'expected ok')
        assertStructurallySame(/** @type {readonly unknown[]} */ (rt[1]), [1, 2])
        // The struct kind's `fromEntries` and the uniform array kind's
        // `map` were the same seam.
        const structValue = Object.defineProperty({ b: 2 }, 'a', {
            get: patchingGetter(1),
            enumerable: true,
            configurable: true,
        })
        const rs = p({ a: number, b: number })(structValue)
        restore()
        assert(rs[0] === 'ok', 'expected ok')
        assertStructurallySame(rs[1], { a: 1, b: 2 })
        const arrayValue = [0, 2]
        Object.defineProperty(arrayValue, 0, {
            get: patchingGetter(1),
            enumerable: true,
            configurable: true,
        })
        const ra = p(array(number))(arrayValue)
        restore()
        assert(ra[0] === 'ok', 'expected ok')
        assertStructurallySame(/** @type {readonly unknown[]} */ (ra[1]), [1, 2])
    },
    // …and `parse` **materializes** the inherited value as an own member of
    // what it builds: the member is *present* — HasProperty is what the
    // check dispatched on — so its parsed value is in the entries the
    // rebuild is made of, and the output carries what was checked rather
    // than a hole at an index the input answered for. A pinned, bounded
    // divergence from the input's own/inherited split, unreachable from
    // FunctionalScript (which has neither mutation nor prototype writes).
    // `validate` is untouched: it returns the value it was given.
    parseMaterializesAnInheritedIndex: () => {
        const value = inheritedIndex()
        const schema = /** @type {const} */ ([number, or(option, number)])
        const r = p(schema)(value)
        assert(r[0] === 'ok', 'expected ok')
        const built = /** @type {ReadonlyArray<Unknown>} */ (r[1])
        assert(Object.hasOwn(built, 1), 'the inherited index is an own member of the result')
        assertEq(built[1], 99, 'carrying its parsed value')
        const rv = v(schema)(value)
        assert(rv[0] === 'ok', 'expected ok')
        assert(Object.is(rv[1], value), '`validate` hands back the value it was given')
        assert(!Object.hasOwn(/** @type {object} */ (rv[1]), 1), 'holes and all')
    },
}
