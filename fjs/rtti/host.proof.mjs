/**
 * The rtti readers against values **FunctionalScript cannot build**.
 *
 * A `proof.mjs` rather than a `proof.f.mjs`, and deliberately: the fixtures
 * here need in-place mutation — `Object.setPrototypeOf` to give an array a
 * prototype that supplies an index, `Object.assign` to put a key past the
 * index range on one — which [`../../AGENTS.md`](../../AGENTS.md) §3.1 forbids
 * in authored FunctionalScript. `shouldLoad` in
 * [`../../dev/module.f.mjs`](../../dev/module.f.mjs) makes a plain
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
 * @import { Unknown } from '../types/rtti/ts/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { undeclaredMembers } from './common/module.f.mjs'
import { toData, validate as dataValidate } from './data/module.f.mjs'
import { array, number, rest, string } from './module.f.mjs'
import { parse } from '../types/rtti/parse/module.f.mjs'
import { validate } from '../types/rtti/validate/module.f.mjs'

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
}
