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
            assertOk(v(['{}', [['a', 1], ['b', 'x']]]))
        },
        error: () => assertNoMatch(v(['{}', [['a', {}]]])),
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
    propertyAccessor: {
        ok: () => {
            assertOk(v(['.', 'a', 'b']))
            assertOk(v(['.', ['[]', [1, 2]], 0]))
        },
        // An absent tuple element reads as `undefined`, and `undefined` is
        // itself a valid `Exp` (see `Primitive`) — so a short accessor still
        // validates. The mirror of `args`'s open trailing side, on the
        // missing side instead.
        missingTailIsUndefined: () => assertOk(v(['.', 'a'])),
        error: () => {
            assertNoMatch(v(['x', 'a', 'b']))
            assertNoMatch(v(['.', {}, 'b']))
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
