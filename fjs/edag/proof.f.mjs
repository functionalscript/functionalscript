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
 * @import { Assert } from '../asserts/types.ts'
 * @import { ValidationError } from '../rtti/common/types.ts'
 * @import { Check, Check3, Unknown } from '../rtti/ts/types.ts'
 * @import { StringMap } from '../types/object/types.ts'
 * @import {
 *  _exp,
 *  _optionLambda,
 *  _optionPropertyLambda,
 *  array,
 *  call,
 *  comma,
 *  dot,
 *  exps,
 *  items,
 *  numberCast,
 *  object,
 *  op0,
 *  op1,
 *  op2,
 *  optionCall,
 *  optionDot,
 *  primitive,
 *  properties,
 *  property,
 *  spread,
 * } from './module.f.mjs'
 * @import {
 *  Array,
 *  Call,
 *  Comma,
 *  Dot,
 *  Exp,
 *  Exps,
 *  Items,
 *  NumberCast,
 *  Object,
 *  Op0,
 *  Op0Id,
 *  Op1,
 *  Op1Id,
 *  Op2,
 *  Op2Id,
 *  OptionCall,
 *  OptionDot,
 *  OptionLambda,
 *  OptionPropertyLambda,
 *  Primitive,
 *  Properties,
 *  Property,
 *  PropertyLambda,
 *  Spread,
 * } from './types.ts'
 */

import { validate } from '../rtti/validate/module.f.mjs'
import { assert, assertEq, assertStructurallySame, todo } from '../asserts/module.f.mjs'
import {
    exp, op0Id, op1Id, op2Id,
    optionLambda, optionPropertyLambda, propertyLambda,
} from './module.f.mjs'

/** @type {(r: readonly [string, unknown]) => void} */
const assertOk = ([k]) => { assertEq(k, 'ok', 'expected ok') }

/**
 * `exp` is a top-level `or` trying every node kind in turn, so when a value
 * matches none of them the reported failure is always the root (`path: []`,
 * `message: 'no match'`) — there is no single branch whose deeper path is
 * "the" failure. Same rule as `../rtti/validate/proof.f.mjs`'s `orRoot`.
 * The three lambda schemas are `or`s too, so their failures report the same
 * way.
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

/**
 * The three chain continuations, validated directly rather than only through
 * the node that owns one. Each is a state of the two hidden-control-flow bits
 * — a live receiver, an open short-circuit region — so which productions each
 * admits *is* the grammar, and reaching them only through `dot`/`?.`/`?.()`
 * would leave that untested where the states differ.
 * @type {(value: Unknown) => readonly [string, unknown]}
 */
const vPropertyLambda = value => validate(propertyLambda)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOptionLambda = value => validate(optionLambda)(value)

/** @type {(value: Unknown) => readonly [string, unknown]} */
const vOptionPropertyLambda = value => validate(optionPropertyLambda)(value)

/** Every id `op0` currently accepts — kept as a literal list, not derived
 * from `op0Id`, so deleting one from the schema reddens exactly its own
 * assertion below rather than silently shrinking this list too. */
const op0Ids = /** @type {const} */ (['undefined', 'args', 'frame'])

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
 * to. It guards both nullish values, as `?.` does: `null?.at` is `undefined`,
 * not a throw, so a guard on `undefined` alone would not be the desugaring of
 * anything. Every branch is taken by `chainsJs.desugaredOptional`, which is
 * also where the assertions live: an assertion inside a `throw` case would be
 * masked, since a failing one throws and so reads as the expected failure.
 *
 * @type {(o: any) => any}
 */
const desugarOptionalAt = o => o !== null && o !== undefined ? o.at : undefined

export const proof = {
    /**
     * Each RTTI constant in `./module.f.mjs` matches its declared type in
     * `./types.ts`. These are compile-time checks; the function body only has
     * to exist so the typedefs have a local scope.
     */
    consistency: () => {
        /** @typedef {Assert<Check3<Exp, typeof _exp, typeof exp>>} _ExpAssert */
        /** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */
        /** @typedef {Assert<Check<Exps, typeof exps>>} _Exps */
        /** @typedef {Assert<Check<Spread, typeof spread>>} _Spread */
        /** @typedef {Assert<Check<Items, typeof items>>} _Items */
        /** @typedef {Assert<Check<Array, typeof array>>} _Array */
        /** @typedef {Assert<Check<Property, typeof property>>} _Property */
        /** @typedef {Assert<Check<Properties, typeof properties>>} _Properties */
        /** @typedef {Assert<Check<Object, typeof object>>} _Object */
        /** @typedef {Assert<Check<NumberCast, typeof numberCast>>} _NumberCast */
        /** @typedef {Assert<Check3<OptionLambda, typeof _optionLambda, typeof optionLambda>>} _OptionLambda */
        /** @typedef {Assert<Check3<OptionPropertyLambda, typeof _optionPropertyLambda, typeof optionPropertyLambda>>} _OptionPropertyLambda */
        /** @typedef {Assert<Check<PropertyLambda, typeof propertyLambda>>} _PropertyLambda */
        /** @typedef {Assert<Check<Call, typeof call>>} _Call */
        /** @typedef {Assert<Check<Dot, typeof dot>>} _Dot */
        /** @typedef {Assert<Check<OptionDot, typeof optionDot>>} _OptionDot */
        /** @typedef {Assert<Check<OptionCall, typeof optionCall>>} _OptionCall */
        /** @typedef {Assert<Check<Comma, typeof comma>>} _Comma */
        /** @typedef {Assert<Check<Op0Id, typeof op0Id>>} _Op0Id */
        /** @typedef {Assert<Check<Op0, typeof op0>>} _Op0 */
        /** @typedef {Assert<Check<Op1Id, typeof op1Id>>} _Op1Id */
        /** @typedef {Assert<Check<Op1, typeof op1>>} _Op1 */
        /** @typedef {Assert<Check<Op2Id, typeof op2Id>>} _Op2Id */
        /** @typedef {Assert<Check<Op2, typeof op2>>} _Op2 */
    },
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
    // Every tuple in the schema is closed — none says `open` — so a trailing
    // element past what a node declares is rejected rather than ignored. That
    // is what makes "exactly one spelling" literal instead of "one spelling up
    // to trailing junk": an `open` tuple would let `['args', 'extra']` be a
    // second graph for the same function, and a fourth element on a `.` node a
    // third.
    closed: {
        extraTailIsError: () => {
            assertNoMatch(v(['args', 'extra']))
            assertNoMatch(v(['neg', 1, 'extra']))
            assertNoMatch(v(['+', 1, 2, 3]))
            assertNoMatch(v(['[]', [], 'extra']))
            assertNoMatch(v(['{}', [], 'extra']))
            assertNoMatch(v(['[]', [['...', 1, 'extra']]]))
            assertNoMatch(v(['{}', [[':', 'a', 1, 'extra']]]))
            assertNoMatch(v([',', [], 'extra']))
            assertNoMatch(v(['()', 'f', 1, 'extra']))
            assertNoMatch(v(['.', 'a', 'b', null, 'extra']))
            assertNoMatch(v(['?.', 'a', 'b', null, 'extra']))
            assertNoMatch(v(['?.()', 'f', 1, null, 'extra']))
            assertNoMatch(v(['.', 'a', 'b', ['|()', 1, null, 'extra']]))
            assertNoMatch(v(['.', 'a', 'b', ['|?.()', 1, null, 'extra']]))
            assertNoMatch(v(['?.', 'a', 'b', ['|.', 'c', null, 'extra']]))
            assertNoMatch(v(['?.', 'a', 'b', ['|!()', 1, null, 'extra']]))
            assertNoMatch(v(['.', 'a', ['Number', 1, 'extra']]))
        },
    },
    dot: {
        ok: () => {
            assertOk(v(['.', 'a', 'b']))
            assertOk(v(['.', ['[]', [1, 2]], 0]))
            // `index`'s three accepted shapes, pinned explicitly: string,
            // number (above), and a `numberCast` (below) — not `boolean`
            // (see `error`).
            assertOk(v(['.', 'a', ['Number', 1]]))
        },
        // `index` — string, number, or `numberCast` — never admitted
        // `undefined`, so a missing index has always been a real error.
        missingIndexIsError: () => assertNoMatch(v(['.', 'a', null])),
        // Ending the chain is the *shorter* arity (`ok` above), so the
        // terminator values are gone: `null` is a primitive again and has no
        // reading in a continuation position, and a present `undefined` never
        // had one.
        terminatorTailIsError: () => {
            assertNoMatch(v(['.', 'a', 'b', null]))
            assertNoMatch(v(['.', 'a', 'b', undefined]))
        },
        // A trailing **hole** is not the short arity: the three-element arm
        // is bounded by length and the four-element arm has no `option`
        // member, so a length-4 value with nothing at index 3 matches
        // neither. `concat` builds one without a hole literal, which
        // FunctionalScript does not have.
        trailingHoleIsError: () =>
            assertNoMatch(v(['.', 'a', 'b'].concat(new Array(1)))),
        error: () => {
            assertNoMatch(v(['x', 'a', 'b', null]))
            assertNoMatch(v(['.', {}, 'b']))
            // `index` excludes `boolean` on purpose — not narrowed to just
            // `string`/`number` by accident.
            assertNoMatch(v(['.', 'a', true]))
        },
    },
    // The chain continuations. There are three because a chain carries two
    // bits — a live receiver (P) and an open short-circuit region (O) — and
    // `00` is the definition of a node boundary, so the fourth cell is an
    // `Exp`. A lambda is never an `exp` (`notAnExp`), and each state admits
    // exactly the steps whose nesting would be observable there.
    lambdas: {
        // `propertyLambda` — P live, no region. Only a call can be here,
        // because only a call spends a receiver; `|()` is terminal and
        // `|?.()` opens a region that owns the rest of the chain.
        propertyLambda: () => {
            assertOk(vPropertyLambda(['|()', 1]))
            assertOk(vPropertyLambda(['|?.()', 1]))
            assertOk(vPropertyLambda(['|?.()', 1, ['|.', 'c']]))
            // No `|.`: a property step here would waste the receiver with no
            // region to keep it in, so `a.b.c` nests `.` nodes instead. That
            // absence is what gives a plain property path one spelling.
            assertNoMatch(vPropertyLambda(['|.', 'c']))
            // No `|!()`: there is no open region for it to close.
            assertNoMatch(vPropertyLambda(['|!()', 1]))
        },
        // `optionLambda` — a plain value inside a region. A call stays in the
        // region (it must, or the region would not cover it) and a property
        // step hands a receiver on within it.
        optionLambda: () => {
            assertOk(vOptionLambda(['|()', 1]))
            assertOk(vOptionLambda(['|.', 'c']))
            assertOk(vOptionLambda(['|.', 'c', ['|!()', 1]]))
            // Neither `|?.()` nor `|!()` is here: with the receiver already
            // spent, guarding or closing at this point protects nothing a
            // nested node would not protect equally.
            assertNoMatch(vOptionLambda(['|?.()', 1]))
            assertNoMatch(vOptionLambda(['|!()', 1]))
        },
        // `optionPropertyLambda` — both bits live, so every production is
        // here: the three ways a call can relate to its region, plus the
        // property step the region will not let leave.
        optionPropertyLambda: () => {
            assertOk(vOptionPropertyLambda(['|()', 1]))
            assertOk(vOptionPropertyLambda(['|.', 'c']))
            assertOk(vOptionPropertyLambda(['|?.()', 1]))
            assertOk(vOptionPropertyLambda(['|!()', 1]))
            // `|.` hands the region back to this same state, so every
            // production above is reachable one property step further in —
            // `a?.b.c?.(...d)` is the guarded call through a `|.`.
            assertOk(vOptionPropertyLambda(['|.', 'c', ['|?.()', 1]]))
            assertOk(vOptionPropertyLambda(['|.', 'c', ['|.', 'd']]))
        },
        // `|.` takes an `index` and the call steps take an `exp`, the same
        // operand schemas the nodes use — so a general `exp` in a naming
        // position is rejected where it is accepted in an argument one.
        operandSchemas: () => {
            assertOk(vOptionLambda(['|.', 0]))
            assertOk(vOptionLambda(['|.', ['Number', 1]]))
            assertNoMatch(vOptionLambda(['|.', ['[]', []]]))
            assertOk(vOptionLambda(['|()', ['[]', [1, 2]]]))
        },
        // A lambda only means anything as the continuation of a chain node:
        // it takes its input implicitly, so on its own it is not an `exp` and
        // cannot be lifted out as a shared node. The `|` prefix is what makes
        // that statable — see `tagsAreDisjoint`.
        notAnExp: () => {
            assertNoMatch(v(['|.', 'b']))
            assertNoMatch(v(['|()', 1]))
            assertNoMatch(v(['|?.()', 1]))
            assertNoMatch(v(['|!()', 1]))
        },
        // The prefix keeps the step vocabulary disjoint from the node one,
        // so a tuple's tag alone says which grammar it belongs to. Unprefixed,
        // `['()', f, k]` would read as a `call` — call `f` with `k` as its
        // arguments — and as a step — call the chain's value with `f` as its
        // arguments, then continue with `k`. Closedness bounds a tuple's
        // length and says nothing about its tag, so no arity separates those
        // readings; these assertions are the disjointness that does.
        tagsAreDisjoint: () => {
            assertOk(v(['()', 'f', null]))
            assertNoMatch(vOptionLambda(['()', 'f', null]))
            assertNoMatch(v(['|()', 'f']))
        },
        // A terminal has one arity, and closedness by length is what keeps
        // the rest from being smuggled past it: `propertyLambda`'s `|()`
        // spends the receiver and exits, `optionPropertyLambda`'s `|!()`
        // closes the region, and neither has a three-element arm to hold a
        // continuation. This is the case the old explicit `null` existed to
        // guard, and length now answers it.
        terminalsTakeNoContinuation: () => {
            assertNoMatch(vPropertyLambda(['|()', 1, ['|.', 'c']]))
            assertNoMatch(vOptionPropertyLambda(['|!()', 1, ['|.', 'c']]))
            // ...including the old spelling, whose `null` is simply a third
            // element the terminal does not declare.
            assertNoMatch(vPropertyLambda(['|()', 1, null]))
            assertNoMatch(vOptionPropertyLambda(['|!()', 1, null]))
        },
        // The steps that *can* continue end by being one element shorter,
        // never by carrying a terminator, and never by leaving a hole where
        // the continuation would go.
        endingIsTheShorterArity: () => {
            assertOk(vOptionPropertyLambda(['|.', 'c']))
            assertOk(vOptionPropertyLambda(['|()', 1]))
            assertOk(vOptionPropertyLambda(['|?.()', 1]))
            assertNoMatch(vOptionPropertyLambda(['|.', 'c', null]))
            assertNoMatch(vOptionPropertyLambda(['|()', 1, undefined]))
            assertNoMatch(vOptionPropertyLambda(['|()', 1].concat(new Array(1))))
        },
        // Each tag is a real constraint, not a stand-in for `string`: a node
        // tag in a step position is rejected, and so is an unknown one.
        unknownOpIsRejected: () => {
            assertNoMatch(vOptionPropertyLambda(['.', 'b']))
            assertNoMatch(vOptionPropertyLambda(['|.z', 'b', null]))
            assertNoMatch(vOptionPropertyLambda('xyz'))
        },
    },
    call: {
        ok: () => {
            assertOk(v(['()', 'f', ['[]', []]]))
            assertOk(v(['()', ['.', 'o', 'k'], 1])) // (0, o.k)(...args)
            assertOk(v(['()', 'f', ['[]', [1, 2]]]))
        },
        // A missing argument operand reads as `undefined` — an error, same
        // as `op1`/`op2`'s `missingTailIsError`.
        missingTailIsError: () => assertNoMatch(v(['()', 'f'])),
        // `()` no longer carries a chain operand: a call with a receiver is a
        // `.` node owning its call, so the three-element shape is the whole
        // node and a `lambdas`-era graph is simply not one.
        lambdasShapeIsError: () => assertNoMatch(v(['()', 'f', [], 1])),
    },
    optionDot: {
        ok: () => {
            assertOk(v(['?.', 'a', 'b']))
            assertOk(v(['?.', 'a', ['Number', 1]]))
            assertOk(v(['?.', 'a', 'b', ['|.', 'c']]))
        },
        // Same three `index` shapes as `.`, `boolean` excluded the same way.
        error: () => {
            assertNoMatch(v(['?.', 'a', true]))
            assertNoMatch(v(['?.z', 'a', 'b', null]))
        },
        // As on `.`: the region ends at the shorter arity, so a terminator
        // value or a trailing hole in the continuation position is an error.
        terminatorTailIsError: () => {
            assertNoMatch(v(['?.', 'a', 'b', null]))
            assertNoMatch(v(['?.', 'a', 'b', undefined]))
        },
        trailingHoleIsError: () =>
            assertNoMatch(v(['?.', 'a', 'b'].concat(new Array(1)))),
    },
    optionCall: {
        ok: () => {
            assertOk(v(['?.()', 'f', 1]))
            assertOk(v(['?.()', 'f', ['[]', [1]], ['|()', 2]]))
        },
        // One continuation, not two: the callee is an ordinary expression, so
        // there is no pre-call chain for this node to own. The *arguments*
        // operand is still required — only the continuation is what the
        // shorter arity leaves out.
        missingArgsIsError: () => assertNoMatch(v(['?.()', 'f'])),
        terminatorTailIsError: () => {
            assertNoMatch(v(['?.()', 'f', 1, null]))
            assertNoMatch(v(['?.()', 'f', 1, undefined]))
        },
        trailingHoleIsError: () =>
            assertNoMatch(v(['?.()', 'f', 1].concat(new Array(1)))),
        error: () => assertNoMatch(v(['?.()', 'f', [], 1, []])),
    },
    // One entry per JS spelling whose grouping or hidden control flow the
    // grammar exists to distinguish — the shape only, since what each
    // denotes is the JSDoc on the nodes in `./module.f.mjs` and the executor
    // proofs in `./amnesia/proof.f.mjs`, and lowering these spellings is
    // `../djs/todo/compile-modules-to-edag.md`. Read as pairs: the members
    // of a pair differ in JS, so they must differ here too.
    chains: {
        // A receiver is born in a `.` (or `?.`) node and spent by the call
        // that node owns. Reaching the call through a complete node instead
        // is the detached spelling, and a different graph.
        receiver: () => {
            assertOk(v(['.', 'a', 'b', ['|()', 'args']])) // a.b(...args)
            assertOk(v(['()', ['.', 'a', 'b'], 'args'])) // (0, a.b)(...args)
            assertOk(v(['.', 'a', 'b', ['|?.()', 'args']])) // a.b?.(...args)
            assertOk(v(['?.()', 'a', 'args'])) // a?.(...args)
            // (a?.(...args))(...args2)
            assertOk(v(['()', ['?.()', 'a', 'args'], 'args2']))
        },
        // A plain property path nests, because `propertyLambda` has no `|.`
        // production — so `a.b.c` has exactly one spelling and the dead-prefix
        // rule needs no lowering pass to hold.
        propertyPath: () => {
            assertOk(v(['.', ['.', 'a', 'b'], 'c'])) // a.b.c
            // a.b(...args).c — the inner call is the inner node's business.
            assertOk(v(['.', ['.', 'a', 'b', ['|()', 'args']], 'c']))
        },
        // An optional region is one continuation chain, however long, and
        // grouping is what ends it: `a?.b.c` skips `.c` on a nullish `a`,
        // `(a?.b).c` throws there — one node against two.
        optionalRegion: () => {
            assertOk(v(['?.', 'a', 'b'])) // a?.b
            assertOk(v(['?.', 'a', 'b', ['|.', 'c']])) // a?.b.c
            assertOk(v(['.', ['?.', 'a', 'b'], 'c'])) // (a?.b).c
            // a?.b.c(...args) — the call is inside the region.
            assertOk(v(['?.', 'a', 'b', ['|.', 'c', ['|()', 'args']]]))
            // (a?.b).c(...args) — the parens ended it, so a `.` node owns the
            // call and `a?.b` is a complete node under it.
            assertOk(v(['.', ['?.', 'a', 'b'], 'c', ['|()', 'args']]))
            // a?.b(...args).c(...args2) — one region across two calls.
            assertOk(v(['?.', 'a', 'b',
                ['|()', 'args', ['|.', 'c', ['|()', 'args2']]]]))
            // a?.(...args).c and a?.(...args)(...args2)
            assertOk(v(['?.()', 'a', 'args', ['|.', 'c']]))
            assertOk(v(['?.()', 'a', 'args', ['|()', 'args2']]))
        },
        // The three ways a call can relate to the region around it — the
        // complete taxonomy, and the reason `|!()` is a tag of its own.
        callsAgainstTheRegion: () => {
            assertOk(v(['?.', 'a', 'b', ['|()', 'args']])) // a?.b(...args)
            assertOk(v(['?.', 'a', 'b', ['|?.()', 'args']])) // a?.b?.(...args)
            assertOk(v(['?.', 'a', 'b', ['|!()', 'args']])) // (a?.b)(...args)
            // (a?.b.c)(...args) — the region closes after a property step,
            // which is the same `|!()` one step further in.
            assertOk(v(['?.', 'a', 'b', ['|.', 'c', ['|!()', 'args']]]))
            // a?.b.c?.(...args) — and so is the guarded call.
            assertOk(v(['?.', 'a', 'b', ['|.', 'c', ['|?.()', 'args']]]))
        },
        // The operands an optional node skips on its nullish branch have to
        // be operands *of* that node, which is what makes `k`/`a`
        // observably unevaluated: `a?.[k]` and `f?.(...a)`.
        skippedOperands: () => {
            assertOk(v(['?.', 'a', ['Number', 'k']])) // a?.[k]
            assertOk(v(['?.()', 'f', 'a'])) // f?.(...a)
        },
    },
    // The four duplicate families a flat step array admitted are not
    // forbidden here — they cannot be written. Each is one production the
    // grammar does not have, and each `assertNoMatch` is the family it kills.
    unspellable: {
        // `a?.b?.c` — no lambda has a `?.` production at all; `?.` is only
        // ever a node tag, so a guarded property access always starts a node.
        optionalPropertyStep: () => {
            assertNoMatch(v(['?.', 'a', 'b', ['|?.', 'c']]))
            assertOk(v(['?.', ['?.', 'a', 'b'], 'c'])) // the spelling
        },
        // `a.b(...c)?.d` — `propertyLambda`'s `|()` is terminal, so the chain
        // exits and what follows is an ordinary node over an ordinary value.
        callTerminatesPropertyLambda: () => {
            assertNoMatch(v(['.', 'a', 'b', ['|()', 'c', ['|.', 'd']]]))
            assertOk(v(['?.', ['.', 'a', 'b', ['|()', 'c']], 'd']))
        },
        // `(a?.(...b))(...c)` — `optionLambda` has no `|!()`, since with the
        // receiver already spent there is nothing for the close to keep. The
        // outer call is a plain `()` over a complete `?.()` node.
        closeWithoutReceiver: () => {
            assertNoMatch(v(['?.()', 'a', 'b', ['|!()', 'c']]))
            assertOk(v(['()', ['?.()', 'a', 'b'], 'c']))
        },
        // `a?.b(...c)?.d` — `optionLambda` has no guarded step either, so the
        // guarded access after the call starts its own node.
        guardedStepAfterCall: () => {
            assertNoMatch(v(['?.', 'a', 'b', ['|()', 'c', ['|?.()', 'd']]]))
            assertOk(v(['?.()', ['?.', 'a', 'b', ['|()', 'c']], 'd']))
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
        // across an optional link too, which is why `(a?.b)(d)` is a `?.`
        // node with a `|!()` continuation, `['?.', a, 'b', ['|!()', d]]`,
        // rather than a `()` over a complete `['?.', a, 'b']`: the
        // latter would produce an ordinary value and lose the receiver.
        receiver: () => {
            const a = [42]
            assertEq(a.at(0), 42)
            assertEq((a.at)(0), 42)
            assertEq((a?.at)(0), 42) // ['?.', a, 'at', ['|!()', …]]
            assertEq((a?.at)?.(0), 42) // ['?.', a, 'at', ['|?.()', …]]
            assertEq(a.at?.(0), 42) // ['.', a, 'at', ['|?.()', …]]
            assertEq(a?.at?.(0), 42) // ['?.', a, 'at', ['|?.()', …]]
        },
        // Short-circuit: a nullish link skips the rest of its chain, and
        // grouping is what ends that chain — `u?.at.name` is `undefined`
        // where `(u?.at).name` throws (`throw.groupedOptional`), one
        // continuation against two nodes.
        shortCircuit: () => {
            /** @type {any} */
            const u = undefined
            assertEq(u?.at, undefined)
            assertEq(u?.at.name, undefined) // ['?.', u, 'at', ['|.', 'name']]
            assertEq(u?.at?.(0), undefined)
            // The operands on the skipped branch are never evaluated: an
            // optional property's index, and an optional call's arguments.
            assertEq(u?.[todo()], undefined)
            assertEq(u?.(todo()), undefined)
        },
        // The quiet half of `throw.groupedOptional`: a group ends the chain,
        // but when what follows is itself guarded the ending is unobservable.
        // That is the parenthesis law's own escape clause, and the reason
        // `null` is the right spelling of a bare `(a?.b)`.
        grouping: () => {
            /** @type {any} */
            const u = undefined
            assertEq((u?.at)?.name, undefined)
            assertEq((u?.at)?.(0), undefined)
        },
        // What the naive desugaring of `?.` gets right, every branch of it:
        // `undefined` on either nullish input, and on anything else the *same
        // function* `a.at` denotes. Nothing is wrong with any of those values
        // — what it loses is the receiver, which `throw.desugaredOptional`
        // pins by calling the last one. That is why `?.` cannot lower to a
        // conditional, and why `(a?.b)(d)` keeps its receiver through a
        // `|!()` step instead of completing a `['?.', …]` node that would
        // hand on an ordinary value.
        desugaredOptional: () => {
            assertEq(desugarOptionalAt(null), undefined)
            assertEq(desugarOptionalAt(undefined), undefined)
            // Identity, not just equality: a receiver-bound function (e.g.
            // `o.at.bind(o)`) is `!==` to `[42].at` even though it behaves
            // the same on `(0)`. So this line and `throw.desugaredOptional`
            // both redden under that mutation — the identity check here,
            // the call there.
            assertEq(desugarOptionalAt([42]), [42].at)
        },
        // The two spellings that differ *only* in whether the arguments ran —
        // `a.b(...c)` throws at the access with `c` untouched, `(a?.b)(...c)`
        // short-circuits, evaluates `c`, and throws at the call — cannot be
        // pinned here, nor by the node either: both readings throw, and a
        // `throw` case is pass/fail rather than payload-inspecting. What
        // carries that order is the shape of `callProperty` in
        // `./amnesia/module.f.mjs`; "Where the host engines disagree" in
        // `./README.md` states the gap. Nor can `(u?.at)(0)` be pinned: both are
        // `|!()` terms, JavaScriptCore (so `bun test`) carries the
        // short-circuit through the parentheses and answers `undefined` where
        // V8 throws, so asserting either answer would redden a runner. The
        // node is unaffected — `['?.', u, 'at', ['|!()', …]]` means the
        // throwing reading — and `optionRegion.throw.closeStepOnUndefined` in
        // `./amnesia/proof.f.mjs` pins it by evaluating the node, which is
        // the only oracle that works on every runner. See "Chains" in
        // `./README.md`. `throw.groupedOptional` below pins the same boundary
        // through a property access, where every engine agrees.
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
            // `(u?.(0))(1)` — the inner call already cleared the receiver, so
            // the group's boundary carries nothing and every runner agrees.
            // That is also why the grammar has no `|!()` in `optionLambda`:
            // this is a plain `()` over a complete `?.()` node.
            groupedOptionalCallOfCall: () => {
                /** @type {any} */
                const u = undefined
                return (u?.(0))(1)
            },
            // Two shapes bun answers differently, so neither can be
            // asserted. Both throw everywhere else; see "Chains" in
            // `./README.md` for which is the engine and which is the
            // transpiler, and
            // `../../todo/blocked/bun-optional-chain-parentheses.md` for what
            // unblocks them. The second must stay commented rather than merely
            // fail: bun rejects it at parse, taking the file down.
            //
            // groupedOptionalCall: () => {
            //     /** @type {any} */
            //     const u = undefined
            //     return (u?.at)(0)
            // },
            //
            // groupedOptionalTag: () => {
            //     /** @type {any} */
            //     const u = undefined
            //     return (u?.at)`tag`
            // },
        },
    },
    // `f(...args)[k](obj.a)` in AST form — exercises the mutual recursion
    // through `exp` rather than any one node kind in isolation.
    nested: () => {
        const value = /** @type {const} */ (['.',
            ['()', 'f', ['args']],
            'k',
            ['|()', ['[]', [['.', 'obj', 'a']]]],
        ])
        assertOk(v(value))
    },
}
