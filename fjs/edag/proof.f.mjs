/**
 * Runtime behavior of the edag `exp` schema — one section per node kind, plus
 * a value nested through several kinds to exercise the mutual recursion.
 *
 * @import { ValidationError } from '../types/rtti/common/types.ts'
 * @import { Unknown } from '../types/rtti/ts/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 */

import { validate } from '../types/rtti/validate/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { exp } from './module.f.mjs'

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/**
 * `exp` is a top-level `or` trying every node kind in turn, so when a value
 * matches none of them the reported failure is always the root (`path: []`,
 * `message: 'no match'`) — there is no single branch whose deeper path is
 * "the" failure. Same rule as `../types/rtti/validate/proof.f.mjs`'s `orRoot`.
 * @type {(r: readonly [string, unknown]) => void}
 */
const assertNoMatch = r => {
    assert(r[0] === 'error', 'expected error')
    const e = /** @type {ValidationError} */ (r[1])
    assertStructurallySame(e.path, [], 'unexpected error path')
    assertEq(e.message, 'no match')
}

/** @type {(value: Unknown) => readonly [string, unknown]} */
const v = value => validate(exp)(value)

export const proof = {
    primitive: {
        ok: () => {
            assertOk(v(null))
            assertOk(v(true))
            assertOk(v(false))
            assertOk(v(42))
            assertOk(v('hello'))
            assertOk(v(7n))
        },
        error: () => {
            // `{}` is a legal `Unknown` value (an object with no properties)
            // but matches none of `exp`'s alternatives — not a primitive,
            // and not a tagged tuple with an index 0.
            assertNoMatch(v({}))
            // Bare `undefined` is not a primitive here — see `undefinedOp`.
            // A bare `undefined` would be indistinguishable from a missing
            // tuple position, so `['undefined']` is its own node instead.
            assertNoMatch(v(undefined))
        },
    },
    undefinedOp: {
        ok: () => assertOk(v(['undefined'])),
        extraTailIsIgnored: () => assertOk(v(['undefined', 'ignored'])),
        error: () => assertNoMatch(v(['undefinedz'])),
    },
    array: {
        ok: () => {
            assertOk(v(['[]', []]))
            assertOk(v(['[]', [1, 'a', true]]))
            assertOk(v(['[]', [1, ['[]', [2, 3]]]])) // an exp nested inside the elements
        },
        error: () => {
            assertNoMatch(v(['[]', 'not-an-array']))
            assertNoMatch(v(['[]', [1, {}]]))
        },
    },
    object: {
        ok: () => {
            assertOk(v(['{}', []]))
            assertOk(v(['{}', [[':', 'a', 1], [':', 'b', 'x']]]))
        },
        error: () => {
            assertNoMatch(v(['{}', [[':', 'a', {}]]])) // bad value
            assertNoMatch(v(['{}', [['a', 1]]])) // missing the `:` tag
            assertNoMatch(v(['{}', [[':', 'a']]])) // missing the value
        },
    },
    args: {
        ok: () => assertOk(v(['args'])),
        // Tuples are open on the trailing side — an element past the schema's
        // own entries is never visited, so it can't fail validation.
        extraTailIsIgnored: () => assertOk(v(['args', 'ignored'])),
        error: () => {
            assertNoMatch(v([]))
            assertNoMatch(v(['argz']))
        },
    },
    numberCast: {
        ok: () => {
            assertOk(v(['Number', 'x']))
            assertOk(v(['Number', ['args']])) // an exp nested inside the cast
        },
        // A missing operand reads as `undefined`, which is no longer a
        // valid bare `exp` (see `undefinedOp`) — so this is a real error,
        // not the open-tail case `args` has. An extra trailing operand is
        // still ignored, same as `args`.
        missingTailIsError: () => assertNoMatch(v(['Number'])),
        extraTailIsIgnored: () => assertOk(v(['Number', 'x', 'extra'])),
        // `numberCast` composes through `exp`'s recursion like any other node.
        asArrayElement: () => assertOk(v(['[]', [['Number', 1]]])),
        asCallee: () => assertOk(v(['()', ['Number', 1], 2])),
        error: () => assertNoMatch(v(['Numberz', 'x'])),
    },
    stringCast: {
        ok: () => {
            assertOk(v(['String', 'x']))
            assertOk(v(['String', ['args']])) // an exp nested inside the cast
        },
        // A missing operand reads as `undefined`, which is no longer a
        // valid bare `exp` (see `undefinedOp`) — so this is a real error,
        // not the open-tail case `args` has. An extra trailing operand is
        // still ignored, same as `args`.
        missingTailIsError: () => assertNoMatch(v(['String'])),
        extraTailIsIgnored: () => assertOk(v(['String', 'x', 'extra'])),
        // `stringCast` composes through `exp`'s recursion like any other node.
        asArrayElement: () => assertOk(v(['[]', [['String', 1]]])),
        asCallee: () => assertOk(v(['()', ['String', 1], 2])),
        error: () => assertNoMatch(v(['Stringz', 'x'])),
    },
    propertyAccessor: {
        ok: () => {
            assertOk(v(['.', 'a', 'b']))
            assertOk(v(['.', ['[]', [1, 2]], 0]))
            // `index`'s three accepted shapes, pinned explicitly: string,
            // number (above), and a `numberCast` (below) — not `boolean`
            // (see `error`).
            assertOk(v(['.', 'a', ['Number', 1]]))
        },
        // `index` — string, number, or `numberCast` — never admitted
        // `undefined`, so a missing index has always been a real error, not
        // the open-tail case `args`'s trailing side has.
        missingIndexIsError: () => assertNoMatch(v(['.', 'a'])),
        error: () => {
            assertNoMatch(v(['x', 'a', 'b']))
            assertNoMatch(v(['.', {}, 'b']))
            // `index` excludes `boolean` on purpose — not narrowed to just
            // `string`/`number` by accident.
            assertNoMatch(v(['.', 'a', true]))
        },
    },
    call: {
        ok: () => assertOk(v(['()', 'f', 1])),
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `undefinedOp`.
        missingTailIsError: () => assertNoMatch(v(['()', 'f'])),
        error: () => assertNoMatch(v(['(x)', 'f', 1])),
    },
    propertyCall: {
        ok: () => assertOk(v(['.()', 'o', 'k', 1])),
        error: () => {
            assertNoMatch(v(['.(x)', 'o', 'k', 1]))
            // The third operand missing reads as `undefined` — an error,
            // same as `call`'s `missingTailIsError`.
            assertNoMatch(v(['.()', 'o', 'k']))
        },
    },
    own: {
        ok: () => assertOk(v(['own', 'o', 'k'])),
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `undefinedOp`.
        missingTailIsError: () => assertNoMatch(v(['own', 'o'])),
        extraTailIsIgnored: () => assertOk(v(['own', 'o', 'k', 'extra'])),
        error: () => assertNoMatch(v(['ownz', 'o', 'k'])),
        // `own`'s point is bypassing the prototype chain — including the
        // `__proto__` special case a computed key already avoids in JS.
        // Demonstrates the pattern `own` denotes; not a schema check.
        js: () => {
            /** @type {<T>(a: StringMap<T>, k: string) => T|undefined } */
            const own = (a, k) => Object.getOwnPropertyDescriptor(a, k)?.value
            const a = { ['__proto__']: 42 }
            assertEq(own(a, '__proto__'), 42)
            assertEq(own(a, 'x'), undefined)
        },
    },
    add: {
        ok: () => {
            assertOk(v(['+', 1, 2]))
            assertOk(v(['+', ['+', 1, 2], 3])) // an exp nested inside an operand
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `undefinedOp`. True whether one or both are missing.
        missingTailIsError: () => {
            assertNoMatch(v(['+', 1]))
            assertNoMatch(v(['+']))
        },
        extraTailIsIgnored: () => assertOk(v(['+', 1, 2, 3])),
        error: () => assertNoMatch(v(['+z', 1, 2])),
    },
    sub: {
        ok: () => {
            assertOk(v(['-', 1, 2]))
            assertOk(v(['-', ['-', 1, 2], 3])) // an exp nested inside an operand
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `undefinedOp`. `neg` is a distinct word tag (`"neg"`,
        // not `"-"`), so this doesn't fall through to it — unlike `add`
        // and `numberCast`, there's no other alternative tagged `"-"` at
        // all, missing one or two operands is equally an error.
        missingTailIsError: () => {
            assertNoMatch(v(['-', 1]))
            assertNoMatch(v(['-']))
        },
        extraTailIsIgnored: () => assertOk(v(['-', 1, 2, 3])),
        error: () => assertNoMatch(v(['-z', 1, 2])),
    },
    neg: {
        ok: () => {
            assertOk(v(['neg', 1]))
            assertOk(v(['neg', ['neg', 1]])) // an exp nested inside the operand
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `undefinedOp`.
        missingTailIsError: () => assertNoMatch(v(['neg'])),
        extraTailIsIgnored: () => assertOk(v(['neg', 1, 'extra'])),
        error: () => assertNoMatch(v(['negz', 1])),
    },
    fn: {
        ok: () => {
            assertOk(v(['=>', ['[]'], 1]))
            assertOk(v(['=>', ['[]'], ['=>', ['[]'], 1]])) // an exp nested inside the body
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp`/`Frame` — see `undefinedOp`. True whether one or both are
        // missing.
        missingTailIsError: () => {
            assertNoMatch(v(['=>', ['[]']]))
            assertNoMatch(v(['=>']))
        },
        extraTailIsIgnored: () => assertOk(v(['=>', ['[]'], 1, 'extra'])),
        error: () => {
            assertNoMatch(v(['=>z', ['[]'], 1]))
            // The frame must be tagged `'[]'` — a wrong tag never matches,
            // unlike the open-trailing-content case below.
            assertNoMatch(v(['=>', ['x'], 1]))
        },
        // `frame`'s schema (`['[]']`) is a one-entry tuple, so — same
        // "trailing positions are open" rule as every other node here —
        // content after the tag is never visited and can't reject. Not a
        // gap specific to `frame`; pinning it so a future reader doesn't
        // mistake it for one.
        nonEmptyFrameContentIsIgnored: () => assertOk(v(['=>', ['[]', 'ignored'], 1])),
    },
    // `f(args)[k](obj.a)` in AST form — exercises the mutual recursion through
    // `exp` rather than any one node kind in isolation.
    nested: () => {
        const value = /** @type {const} */ (['.()',
            ['()', 'f', ['args']],
            'k',
            ['.', 'obj', 'a'],
        ])
        assertOk(v(value))
    },
}
