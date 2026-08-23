/**
 * Runtime behavior of the edag `exp` schema — one section per node kind, plus
 * a value nested through several kinds to exercise the mutual recursion.
 * Exception: `comma` has no section of its own — its shape (`[',', exps]`) is
 * a known-incomplete placeholder pending a redesign that can express "at
 * least two operands, last is the result, each pre-result operand a true
 * root" (a single-operand `,` is the identity, a reachable operand a
 * redundant anchor — both non-canonical), not a settled node to pin. The
 * `exps` section does validate `,`-tagged values, but only to reach `exps`,
 * which `comma` is now the sole route to; it pins the operand array's
 * element schema, and claims nothing about what a `,` means.
 *
 * @import { ValidationError } from '../types/rtti/common/types.ts'
 * @import { Unknown } from '../types/rtti/ts/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 */

import { validate } from '../types/rtti/validate/module.f.mjs'
import { assert, assertEq, assertStructurallySame, todo } from '../asserts/module.f.mjs'
import {
    exp, lambdaCallId, lambdaPropertyAccessorId, op0Id, op1Id, op2Id,
} from './module.f.mjs'

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
const vLambdaPropertyAccessorId = value => validate(lambdaPropertyAccessorId)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vLambdaCallId = value => validate(lambdaCallId)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOp1Id = value => validate(op1Id)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOp2Id = value => validate(op2Id)(value)

/** Every id `op0` currently accepts — kept as a literal list, not derived
 * from `op0Id`, so deleting one from the schema reddens exactly its own
 * assertion below rather than silently shrinking this list too. */
const op0Ids = /** @type {const} */ (['undefined', 'args', 'frame'])

/** Same purpose as `op0Ids`, for the property and call `lambda` steps. */
const lambdaPropertyAccessorIds = /** @type {const} */ (['|.', '|?.'])

/** Same purpose as `op0Ids`, for the call `lambda` steps. */
const lambdaCallIds = /** @type {const} */ (['|()', '|?.()'])

/** Same purpose as `op0Ids`, for `op1`. */
const op1Ids = /** @type {const} */ (['String', 'Number', 'neg', '!', '~'])

/** Same purpose as `op0Ids`, for `op2`. */
const op2Ids = /** @type {const} */ ([
    '=>', 'own',
    '===', '!==', '>', '>=', '<', '<=',
    '+', '-', '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??',
])

/**
 * The naive desugaring of `a?.at` — the shape `?.` looks like it could lower
 * to. Both of its branches are taken by `chainsJs.desugaredOptional`, which
 * is also where the assertions live: an assertion inside a `throw` case would
 * be masked, since a failing one throws and so reads as the expected failure.
 *
 * @type {(o: any) => any}
 */
const desugarOptionalAt = o => o !== undefined ? o.at : undefined

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
    // `comma` is `exps`'s only route now that `array` holds `rttiArray(items)`,
    // so these pin `exps` — an array of `exp`, not a single one — through it.
    // The `,` node's own contract is still unsettled (see the module note
    // above); nothing here depends on it beyond the tag and the operand slot.
    exps: {
        ok: () => {
            assertOk(v([',', []]))
            assertOk(v([',', [1, 'a', true]]))
            assertOk(v([',', [['[]', []]]])) // an exp nested inside the operands
        },
        // The operand is the array, not one `exp` in its place — the
        // single-vs-array slip that `array` carried until this branch. A
        // bare string is a valid `exp`, so were `exps` a single `exp` this
        // would validate.
        singleExpIsError: () => assertNoMatch(v([',', 'not-an-array'])),
        error: () => assertNoMatch(v([',', [{}]])),
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
    // The `lambda` steps, and the `lambdas` array of them that `call`,
    // `optionalPropertyAccessor`, and `optionalCall` carry. A `lambda` is a
    // structural step, never an `exp`, so every value here is reached
    // through a node that owns a `lambdas` — there is no `v(step)` route to
    // one, which `notAnExp` below pins. The four ids are two schemas, split
    // by operand shape like `op1`/`op2`: `index` for the property steps,
    // `exp` for the call steps.
    lambdas: {
        ok: () => {
            assertOk(v(['()', 'f', [], 1])) // no steps at all
            // Every id each schema accepts, pinned individually — the same
            // literal-list discipline as `op0Ids`/`op1Ids`/`op2Ids`.
            for (const id of lambdaPropertyAccessorIds) {
                assertOk(v(['()', 'f', [[id, 'b']], 1]))
            }
            for (const id of lambdaCallIds) {
                assertOk(v(['()', 'f', [[id, 1]], 2]))
            }
            // `index` in the property steps, `exp` in the call steps — the
            // same operand schemas the expression-level nodes use.
            assertOk(v(['()', 'f', [['|.', 0], ['|?.', ['Number', 1]]], 1]))
            assertOk(v(['()', 'f', [['|()', ['[]', [1, 2]]]], 1]))
            // The two schemas differ in more than their tag: a property
            // step's operand is an `index`, so a general `exp` is rejected
            // there, while a call step takes any `exp`.
            assertNoMatch(v(['()', 'f', [['|.', ['[]', []]]], 1]))
            assertOk(v(['()', 'f', [['|()', ['[]', []]]], 1]))
        },
        // A `lambda` only means anything as the n-th step of a `lambdas`:
        // it takes its input implicitly, so on its own it is not an `exp`
        // and cannot be lifted out as a shared node.
        notAnExp: () => {
            assertNoMatch(v(['|.', 'b']))
            assertNoMatch(v(['|()', 1]))
            assertNoMatch(v(['|?.', 'b']))
            assertNoMatch(v(['|?.()', 1]))
        },
        // The operand is the array of steps, not one step in its place —
        // the single-vs-array slip `exps` pins for `,`.
        singleOpIsError: () => assertNoMatch(v(['()', 'f', ['|.', 'b'], 1])),
        missingTailIsError: () => {
            assertNoMatch(v(['()', 'f', [['|.']], 1]))
            assertNoMatch(v(['()', 'f', [['|()']], 1]))
            assertNoMatch(v(['()', 'f', [['|?.']], 1]))
            assertNoMatch(v(['()', 'f', [['|?.()']], 1]))
        },
        extraTailIsIgnored: () => assertOk(v(['()', 'f', [['|.', 'b', 'extra']], 1])),
        // Each id vocabulary is a real constraint, not a stand-in for
        // `string`: an expression-level tag in a step position is rejected,
        // so is an unknown one, and so is a call id where a property id
        // belongs — the two schemas are told apart by their tag alone.
        unknownOpIsRejected: () => {
            assertNoMatch(vLambdaPropertyAccessorId('xyz'))
            assertNoMatch(vLambdaCallId('xyz'))
            assertNoMatch(vLambdaPropertyAccessorId('|()'))
            assertNoMatch(v(['()', 'f', [['.', 'b']], 1]))
            assertNoMatch(v(['()', 'f', [['|.z', 'b']], 1]))
        },
    },
    call: {
        ok: () => {
            assertOk(v(['()', 'f', [], ['[]', []]]))
            assertOk(v(['()', ['.', 'o', 'k'], [], 1]))
            assertOk(v(['()', 'o', [['|.', 'k']], 1])) // o.k(...args)
        },
        // The `lambdas` operand is not optional: the pre-`lambdas` binary
        // shape reads `1` as the `lambdas` and leaves no argument operand.
        binaryShapeIsError: () => assertNoMatch(v(['()', 'f', 1])),
        // A missing argument operand reads as `undefined` — an error, same
        // as `op1`/`op2`'s `missingTailIsError`.
        missingTailIsError: () => assertNoMatch(v(['()', 'f', []])),
        extraTailIsIgnored: () => assertOk(v(['()', 'f', [], 1, 'extra'])),
    },
    optionalPropertyAccessor: {
        ok: () => {
            assertOk(v(['?.', 'a', 'b', []]))
            assertOk(v(['?.', 'a', ['Number', 1], []]))
            assertOk(v(['?.', 'a', 'b', [['|.', 'c']]]))
        },
        // Same three `index` shapes as `.`, `boolean` excluded the same way.
        error: () => {
            assertNoMatch(v(['?.', 'a', true, []]))
            assertNoMatch(v(['?.z', 'a', 'b', []]))
        },
        // The `lambdas` operand is required — `[]` says "the optional region
        // ends here", a missing position says nothing.
        missingTailIsError: () => assertNoMatch(v(['?.', 'a', 'b'])),
        extraTailIsIgnored: () => assertOk(v(['?.', 'a', 'b', [], 'extra'])),
    },
    optionalCall: {
        ok: () => {
            assertOk(v(['?.()', 'f', [], 1, []]))
            assertOk(v(['?.()', 'a', [['|.', 'b']], 1, [['|()', 2]]]))
        },
        // Both lambdas are required: the pre-call one that may leave a
        // receiver, and the continuation run on the call's result.
        missingTailIsError: () => {
            assertNoMatch(v(['?.()', 'f', [], 1]))
            assertNoMatch(v(['?.()', 'f', []]))
        },
        extraTailIsIgnored: () => assertOk(v(['?.()', 'f', [], 1, [], 'extra'])),
        error: () => assertNoMatch(v(['?.()', 'f', 1, 1, []])),
    },
    // One entry per JS spelling whose grouping or hidden control flow the
    // vocabulary exists to distinguish — the shape only, since nothing
    // executes an EDAG yet: what each denotes is the JSDoc on the nodes in
    // `./module.f.mjs`, and lowering these spellings is
    // `../djs/todo/compile-modules-to-edag.md`. Read as pairs: the members
    // of a pair differ in JS, so they must differ here too.
    chains: {
        // An optional region is one flat `lambdas`, however long, and
        // grouping is what ends it: `a?.b.c` skips `.c` on a nullish `a`,
        // `(a?.b).c` throws there — one node against two.
        optionalRegion: () => {
            assertOk(v(['?.', 'a', 'b', []])) // a?.b
            assertOk(v(['?.', 'a', 'b', [['|.', 'c']]])) // a?.b.c
            assertOk(v(['.', ['?.', 'a', 'b', []], 'c'])) // (a?.b).c
            // a?.b.c?.d.e — still one array; `|?.d` short-circuits only the
            // `|.e` after it.
            assertOk(v(['?.', 'a', 'b', [
                ['|.', 'c'],
                ['|?.', 'd'],
                ['|.', 'e'],
            ]]))
            // (a?.b)?.c — grouping ends the region, so the second `?.` is an
            // expression-level node over the first.
            assertOk(v(['?.', ['?.', 'a', 'b', []], 'c', []]))
        },
        // The operands an optional node skips on its nullish branch have to
        // be operands *of* that node, which is what makes `k`/`a`
        // observably unevaluated: `a?.[k]` and `f?.(...a)`.
        skippedOperands: () => {
            assertOk(v(['?.', 'a', ['Number', 'k'], []])) // a?.[k]
            assertOk(v(['?.()', 'f', [], 'a', []])) // f?.(...a)
        },
        // Every call is `()`; the receiver comes from its `lambdas`, never from
        // the tag. `(a.b.c)(d)` and `a.b.c(d)` are the same graph — parens
        // around a non-optional chain change nothing.
        receiver: () => {
            assertOk(v(['()', 'f', [], ['[]', ['d']]])) // f(d)
            assertOk(v(['()', 'a', [['|.', 'b']], ['[]', ['d']]])) // a.b(d)
            // (a.b.c)(d)
            assertOk(v(['()', 'a', [['|.', 'b'], ['|.', 'c']], ['[]', ['d']]]))
            // a?.b.c(d) — the call is inside the optional region.
            assertOk(v(['?.', 'a', 'b', [
                ['|.', 'c'],
                ['|()', ['[]', ['d']]],
            ]]))
            // (a?.b)(d) and (a?.b.c)(d) — the parens end the optional
            // region but keep the receiver, so the optional steps move into
            // the call's own `lambdas`.
            assertOk(v(['()', 'a', [['|?.', 'b']], ['[]', ['d']]]))
            assertOk(v(['()', 'a', [['|?.', 'b'], ['|.', 'c']], ['[]', ['d']]]))
            // (a?.(b).c)(d) — a call step before the receiver-producing one.
            assertOk(v(['()', 'a', [
                ['|?.()', ['[]', ['b']]],
                ['|.', 'c'],
            ], ['[]', ['d']]]))
            // (a?.(...b)?.c)(d) — same, with the property step optional too.
            assertOk(v(['()', 'a', [
                ['|?.()', 'b'],
                ['|?.', 'c'],
            ], ['[]', ['d']]]))
            // (a?.c.d.e(f))(g) — the inner call consumed the receiver of
            // `.e`, so the outer call's `lambdas` is empty.
            assertOk(v(['()',
                ['?.', 'a', 'c', [
                    ['|.', 'd'],
                    ['|.', 'e'],
                    ['|()', ['[]', ['f']]],
                ]],
                [],
                ['[]', ['g']],
            ]))
        },
        // An optional call keeps its receiver the same way, and where the
        // parens fall decides which node owns the rest of the chain.
        optionalCallReceiver: () => {
            assertOk(v(['?.()', 'a', [['|.', 'b']], ['[]', ['d']], []])) // a.b?.(d)
            assertOk(v(['?.()', 'a', [['|?.', 'b']], ['[]', ['d']], []])) // (a?.b)?.(d)
            // a?.b?.(c).d(f) — one region owned by the outer `?.`.
            assertOk(v(['?.', 'a', 'b', [
                ['|?.()', ['[]', ['c']]],
                ['|.', 'd'],
                ['|()', ['[]', ['f']]],
            ]]))
            // (a?.b)?.(c).d(f) — the same JS suffix, now the optional
            // call's continuation, because the parens moved the boundary.
            assertOk(v(['?.()', 'a', [['|?.', 'b']], ['[]', ['c']], [
                ['|.', 'd'],
                ['|()', ['[]', ['f']]],
            ]]))
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
            assertOk(v(['()', ['Number', 1], [], 2]))
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
    // The JS these nodes have to agree with, run on the host engine — the
    // `ownJs` pattern one level up: what the vocabulary denotes, not what the
    // schema accepts. Every spelling here is one `chains` pins the shape of,
    // and each is why that shape is what it is. `todo()` always throws, so it
    // doubles as an evaluation probe: reaching it is observable without any
    // mutation, and a case that returns instead proves the operand was
    // skipped.
    chainsJs: {
        // Receiver: a property reference carries its base into the call as
        // `this`, and parentheses around the reference do not break that —
        // only detaching the value does (`throw.detachedReceiver`). It holds
        // across an optional link too, which is why `(a?.b)(d)` keeps `?.b`
        // as a step of the call's own `lambdas`, `['()', a, [['|?.', 'b']], d]`,
        // rather than calling a complete `['?.', a, 'b', []]` node: the
        // latter would produce an ordinary value and lose the receiver.
        receiver: () => {
            const a = [42]
            assertEq(a.at(0), 42)
            assertEq((a.at)(0), 42)
            assertEq((a?.at)(0), 42) // ['()', a, [['|?.', 'at']], …]
            assertEq((a?.at)?.(0), 42) // ['?.()', a, [['|?.', 'at']], …, []]
            assertEq(a.at?.(0), 42) // ['?.()', a, [['|.', 'at']], …, []]
            assertEq(a?.at?.(0), 42) // ['?.', a, 'at', [['|?.()', …]]]
        },
        // Short-circuit: a nullish link skips the rest of its chain, and
        // grouping is what ends that chain — `u?.at.name` is `undefined`
        // where `(u?.at).name` throws (`throw.groupedOptional`), one
        // `lambdas` against two nodes.
        shortCircuit: () => {
            /** @type {any} */
            const u = undefined
            assertEq(u?.at, undefined)
            assertEq(u?.at.name, undefined) // ['?.', u, 'at', [['|.', 'name']]]
            assertEq(u?.at?.(0), undefined)
            // The operands on the skipped branch are never evaluated: an
            // optional property's index, and an optional call's arguments.
            assertEq(u?.[todo()], undefined)
            assertEq(u?.(todo()), undefined)
        },
        // What the naive desugaring of `?.` gets right, both branches of it:
        // `undefined` on a nullish input, and on any other the *same function*
        // `a.at` denotes. Nothing is wrong with either value — what it loses
        // is the receiver, which `throw.desugaredOptional` pins by calling the
        // second one. That is why `?.` cannot lower to a conditional, and why
        // `(a?.b)(d)` keeps `?.b` as a step of the call's own `lambdas`,
        // `['()', a, [['|?.', 'b']], d]`, instead of completing an `['?.', …]`
        // node that would hand on an ordinary value.
        desugaredOptional: () => {
            assertEq(desugarOptionalAt(undefined), undefined)
            assertEq(desugarOptionalAt([42]), [42].at)
        },
        // The call counterpart of `throw.groupedOptional` — `(u?.at)(0)`,
        // which calls `undefined` and throws under the spec and V8 — is
        // deliberately absent: JavaScriptCore (so `bun test`) short-circuits
        // it and evaluates to `undefined` instead, so asserting either
        // answer would redden a runner. The node it denotes is unaffected —
        // `['()', u, [['|?.', 'at']], …]` means the throwing reading — and
        // `throw.groupedOptional` pins the same boundary through a property
        // access, where every engine agrees. See "Chains" in `./README.md`.
        throw: {
            // `const at = a.at; at(0)` — the value without its receiver,
            // the case that makes receiver state part of what a graph means.
            detachedReceiver: () => {
                const at = [42].at
                return at(0)
            },
            // The desugaring above, called: `42` through `(a?.at)(0)`
            // (`receiver`), a throw once a conditional has made it a value.
            desugaredOptional: () => desugarOptionalAt([42])(0),
            // `(u?.at).name` — the parens ended the optional chain, so
            // `.name` runs on `undefined` instead of being skipped.
            groupedOptional: () => {
                /** @type {any} */
                const u = undefined
                return (u?.at).name
            },
            // The mirror of `shortCircuit`'s last two: on a non-nullish
            // input those same operands *are* evaluated.
            evaluatedIndex: () => [42]?.[todo()],
            evaluatedArgument: () => [42].at?.(todo()),
        },
    },
    // `f(...args)[k](obj.a)` in AST form — exercises the mutual recursion
    // through `exp` rather than any one node kind in isolation.
    nested: () => {
        const value = /** @type {const} */ (['()',
            ['()', 'f', [], ['args']],
            [['|.', 'k']],
            ['[]', [['.', 'obj', 'a']]],
        ])
        assertOk(v(value))
    },
}
