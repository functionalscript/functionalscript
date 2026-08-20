/**
 * Runtime behavior of the edag `exp` schema — one section per node kind, plus
 * a value nested through several kinds to exercise the mutual recursion.
 *
 * @import { ValidationError } from '../types/rtti/common/types.ts'
 * @import { Unknown } from '../types/rtti/ts/types.ts'
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
            assertOk(v(undefined))
            assertOk(v(null))
            assertOk(v(true))
            assertOk(v(false))
            assertOk(v(42))
            assertOk(v('hello'))
            assertOk(v(7n))
        },
        // `{}` is a legal `Unknown` value (an object with no properties) but
        // matches none of `exp`'s alternatives — not a primitive, and not a
        // tagged tuple with an index 0.
        error: () => assertNoMatch(v({})),
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
        // Same open-tuple behavior as `args`: a missing operand reads as
        // `undefined` (a valid exp), and an extra trailing operand is never
        // visited.
        missingTailIsUndefined: () => assertOk(v(['Number'])),
        extraTailIsIgnored: () => assertOk(v(['Number', 'x', 'extra'])),
        // `numberCast` composes through `exp`'s recursion like any other node.
        asArrayElement: () => assertOk(v(['[]', [['Number', 1]]])),
        asCallee: () => assertOk(v(['()', ['Number', 1], 2])),
        error: () => assertNoMatch(v(['Numberz', 'x'])),
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
        // Unlike `call`'s second position (still plain `exp`, which includes
        // `undefined`), `propertyAccessor`'s index is `index` — string,
        // number, or `numberCast` — none of which admit `undefined`. So a
        // missing index is a real validation error, not the open-tail case
        // `args`/`call` have.
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
        missingTailIsUndefined: () => assertOk(v(['()', 'f'])),
        error: () => assertNoMatch(v(['(x)', 'f', 1])),
    },
    propertyCall: {
        ok: () => assertOk(v(['.()', 'o', 'k', 1])),
        error: () => assertNoMatch(v(['.(x)', 'o', 'k', 1])),
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
