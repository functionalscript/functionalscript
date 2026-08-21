/**
 * Runtime behavior of the edag `exp` schema — one section per node kind, plus
 * a value nested through several kinds to exercise the mutual recursion.
 * Exception: `comma` has no section yet — its shape (`[',', exps]`) is a
 * known-incomplete placeholder pending a redesign that can express "at
 * least two operands, last is the result, each pre-result operand a true
 * root" (a single-operand `,` is the identity, a reachable operand a
 * redundant anchor — both non-canonical), not a settled node to pin.
 *
 * @import { ValidationError } from '../types/rtti/common/types.ts'
 * @import { Unknown } from '../types/rtti/ts/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 */

import { validate } from '../types/rtti/validate/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.mjs'
import { exp, op0Id, op1Id, op2Id } from './module.f.mjs'

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

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOp0Id = value => validate(op0Id)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOp1Id = value => validate(op1Id)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOp2Id = value => validate(op2Id)(value)

/** Every id `op0` currently accepts — kept as a literal list, not derived
 * from `op0Id`, so deleting one from the schema reddens exactly its own
 * assertion below rather than silently shrinking this list too. */
const op0Ids = /** @type {const} */ (['undefined', 'args', 'frame'])

/** Same purpose as `op0Ids`, for `op1`. */
const op1Ids = /** @type {const} */ (['String', 'Number', 'neg', '!', '~'])

/** Same purpose as `op0Ids`, for `op2`. */
const op2Ids = /** @type {const} */ ([
    '=>', 'own', '()',
    '===', '!==', '>', '>=', '<', '<=',
    '+', '-', '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??',
])

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
            // Bare `undefined` is not a primitive here — see `op0`.
            // A bare `undefined` would be indistinguishable from a missing
            // tuple position, so `['undefined']` is its own node instead.
            assertNoMatch(v(undefined))
        },
    },
    array: {
        ok: () => {
            assertOk(v(['[]', []]))
            assertOk(v(['[]', [1, 'a', true]]))
            assertOk(v(['[]', [1, ['[]', [2, 3]]]])) // an exp nested inside the elements
            // `spread` (`['...', exp]`) is not a top-level `exp` alternative —
            // it's only reachable as an `items` alternative here, or as a
            // `properties` alternative below in `object`.
            assertOk(v(['[]', [1, ['...', 2]]])) // a spread element among plain elements
        },
        error: () => {
            assertNoMatch(v(['[]', 'not-an-array']))
            assertNoMatch(v(['[]', [1, {}]]))
            assertNoMatch(v(['[]', [['...']]])) // spread missing its operand
            assertNoMatch(v(['[]', [['..', 2]]])) // wrong tag, not `...`
        },
    },
    object: {
        ok: () => {
            assertOk(v(['{}', []]))
            assertOk(v(['{}', [[':', 'a', 1], [':', 'b', 'x']]]))
            assertOk(v(['{}', [[':', 'a', 1], ['...', 2]]])) // a spread entry among plain properties
        },
        error: () => {
            assertNoMatch(v(['{}', [[':', 'a', {}]]])) // bad value
            assertNoMatch(v(['{}', [['a', 1]]])) // missing the `:` tag
            assertNoMatch(v(['{}', [[':', 'a']]])) // missing the value
            assertNoMatch(v(['{}', [['...']]])) // spread missing its operand
        },
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
        // the open-tail case `op0`'s trailing side has.
        missingIndexIsError: () => assertNoMatch(v(['.', 'a'])),
        error: () => {
            assertNoMatch(v(['x', 'a', 'b']))
            assertNoMatch(v(['.', {}, 'b']))
            // `index` excludes `boolean` on purpose — not narrowed to just
            // `string`/`number` by accident.
            assertNoMatch(v(['.', 'a', true]))
        },
    },
    propertyCall: {
        ok: () => assertOk(v(['.()', 'o', 'k', 1])),
        error: () => {
            assertNoMatch(v(['.(x)', 'o', 'k', 1]))
            // The third operand missing reads as `undefined` — an error,
            // same as `op1`/`op2`'s `missingTailIsError`.
            assertNoMatch(v(['.()', 'o', 'k']))
        },
    },
    op0: {
        ok: () => {
            // Every id `op0` accepts, pinned individually: deleting any one
            // of these three from `op0Id` reddens exactly this loop, not
            // some other assertion that happens to still pass.
            for (const id of op0Ids) {
                assertOk(v([id]))
            }
        },
        // Tuples are open on the trailing side — an element past the schema's
        // own entries is never visited, so it can't fail validation.
        extraTailIsIgnored: () => assertOk(v(['args', 'ignored'])),
        error: () => {
            assertNoMatch(v([]))
            assertNoMatch(v(['argz']))
        },
        // `op0Id` is a real constraint, not a stand-in for `string`: an id
        // outside its three members is rejected, both directly and as part
        // of a full `exp` value.
        unknownIdIsRejected: () => {
            assertNoMatch(vOp0Id('xyz'))
            assertNoMatch(v(['xyz']))
        },
    },
    op1: {
        ok: () => {
            // Every id `op1` accepts, pinned individually: deleting any one
            // of these five from `op1Id` reddens exactly this loop, not
            // some other assertion that happens to still pass.
            for (const id of op1Ids) {
                assertOk(v([id, 1]))
            }
            assertOk(v(['neg', ['neg', 1]])) // an exp nested inside the operand
            // Composes through `exp`'s recursion like any other node.
            assertOk(v(['[]', [['Number', 1]]]))
            assertOk(v(['()', ['Number', 1], 2]))
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `op0`.
        missingTailIsError: () => assertNoMatch(v(['neg'])),
        extraTailIsIgnored: () => assertOk(v(['neg', 1, 'extra'])),
        error: () => assertNoMatch(v(['negz', 1])),
        // `op1Id` is a real constraint, not a stand-in for `string`: an id
        // outside its five members is rejected, both directly and as part
        // of a full `exp` value.
        unknownIdIsRejected: () => {
            assertNoMatch(vOp1Id('xyz'))
            assertNoMatch(v(['xyz', 1]))
        },
        // `own`'s point is bypassing the prototype chain — including the
        // `__proto__` special case a computed key already avoids in JS.
        // Demonstrates the pattern `['own', ...]` (an `op2` id) denotes;
        // not a schema check.
        ownJs: () => {
            /** @type {<T>(a: StringMap<T>, k: string) => T|undefined } */
            const own = (a, k) => Object.getOwnPropertyDescriptor(a, k)?.value
            const a = { ['__proto__']: 42 }
            assertEq(own(a, '__proto__'), 42)
            assertEq(own(a, 'x'), undefined)
        },
    },
    op2: {
        ok: () => {
            // Every id `op2` accepts, pinned individually: deleting any one
            // of the twenty-four from `op2Id` reddens exactly this loop, not
            // some other assertion that happens to still pass.
            for (const id of op2Ids) {
                assertOk(v([id, 1, 2]))
            }
            assertOk(v(['+', ['+', 1, 2], 3])) // an exp nested inside an operand
        },
        // A missing operand reads as `undefined`, no longer a valid bare
        // `exp` — see `op0`. True whether one or both are missing.
        missingTailIsError: () => {
            assertNoMatch(v(['+', 1]))
            assertNoMatch(v(['+']))
        },
        extraTailIsIgnored: () => assertOk(v(['+', 1, 2, 3])),
        error: () => assertNoMatch(v(['+z', 1, 2])),
        // Same point as `op1`'s: `op2Id` constrains membership.
        unknownIdIsRejected: () => {
            assertNoMatch(vOp2Id('xyz'))
            assertNoMatch(v(['xyz', 1, 2]))
        },
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
