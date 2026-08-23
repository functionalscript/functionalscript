/**
 * @module
 *
 * @import { Assert } from '../asserts/types.ts'
 * @import { Check, Check3 } from '../types/rtti/ts/types.ts'
 * @import {
 *  Array,
 *  Exp,
 *  Primitive,
 *  Property,
 *  NumberCast,
 *  PropertyAccessor,
 *  Object,
 *  LambdaPropertyAccessorId,
 *  LambdaPropertyAccessor,
 *  LambdaCallId,
 *  LambdaCall,
 *  Lambda,
 *  Lambdas,
 *  Call,
 *  OptionalPropertyAccessor,
 *  OptionalCall,
 *  Comma,
 *  Op2Id,
 *  Op2,
 *  Op1Id,
 *  Op1,
 *  Op0Id,
 *  Op0,
 *  Spread,
 *  Items,
 *  Properties,
 *  Exps,
 * } from './types.ts'
 * @import { Phantom } from '../types/phantom/types.ts'
 */

import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray,
} from "../types/rtti/module.f.mjs";

/**
 * `propertyAccessor`, the call nodes, the `lambda` steps, and
 * `op0`/`op1`/`op2` (like `array`/`object`) are open on trailing/extra
 * elements — see "Structs and tuples are open" in
 * `../types/rtti/README.md`. Exact arity is tracked as future work in
 * `../types/rtti/todo/close-type.md`, not implemented here yet. No operand of
 * any node here is optional: a chain step that does no further work carries
 * an empty `lambdas` array, never a missing position.
 *
 * Do not call `parse(exp)` or rely on `validate(exp)` rejecting cycles
 * without reading `../types/rtti/todo/identity-aware-parse.md` first —
 * neither is identity-aware, and that TODO covers why and what's missing.
 */

// Exp

/**
 * Written out explicitly, not `@type {const}`: that can't apply to the
 * arrow function itself (TS1355, literals only), and applied to just the
 * returned array it still can't resolve the cycle back through `array`/
 * `object`/`op0`/... to `exp` — declaration emit elides it to `any`.
 *
 * @type {() => readonly['or',
 *  typeof primitive,
 *  typeof array,
 *  typeof object,
 *  typeof propertyAccessor,
 *  typeof call,
 *  typeof optionalPropertyAccessor,
 *  typeof optionalCall,
 *  typeof comma,
 *  typeof op2,
 *  typeof op1,
 *  typeof op0,
 * ]}
 */
const _exp = () => (['or',
    primitive,
    array,
    object,
    propertyAccessor,
    call,
    optionalPropertyAccessor,
    optionalCall,
    comma,
    op2,
    op1,
    op0,
])

/** @type {Phantom<typeof _exp, Exp>} */
export const exp = _exp

/** @typedef {Assert<Check3<Exp, typeof _exp, typeof exp>>} _ExpAssert */

// Primitive

/**
 * Bare constant values — no tag, no operands, not an operation node at all.
 * `undefined` is deliberately not among them: its EDAG representation,
 * `['undefined']`, *is* a tagged operation node (so a bare `undefined` stays
 * distinguishable from a missing tuple position), which puts it in the
 * `op0`/`op1`/`op2` grouping below by the same arity rule as every other
 * operation, not here.
 */
export const primitive = or(null, boolean, number, string, bigint)

/** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */

// Exps

export const exps = rttiArray(exp)

/** @typedef {Assert<Check<Exps, typeof exps>>} _Exps */

// Spread

/**
 * ```js
 * [...exp]  // as an array item, through `items` — see `array`
 * {...exp}  // as an object property, through `properties` — see `object`
 * ```
 *
 * Not a top-level `Exp`: `spread` only appears as an `items`/`properties`
 * alternative, never as an operand an operation node can hold directly.
 */
export const spread = /** @type {const} */(['...', exp])

/** @typedef {Assert<Check<Spread, typeof spread>>} _Spread */

// Items

/** An array element: a plain `exp`, or a `spread` splicing another array in. */
export const items = or(exp, spread)

/** @typedef {Assert<Check<Items, typeof items>>} _Items */

// Array

/**
 * ```js
 * [exp0, exp1]
 * [exp0, ...exp1]
 * ```
 */
export const array = /** @type {const} */(['[]', rttiArray(items)])

/** @typedef {Assert<Check<Array, typeof array>>} _Array */

// Property

/**
 * A structural operand of `object`, not an independently evaluated EDAG
 * node: nothing ever evaluates a descriptor as a value, so whether one is
 * shared by reference or written twice with equal content is unobservable,
 * and conforming VMs may legally differ on it. Only the `key` and `value`
 * operands are real nodes, their identities shared normally.
 *
 * The key stays `exp`, not narrowed to a string constant, and its evaluated
 * value is coerced via JS `ToPropertyKey` when the property is defined —
 * see `../../todo/edag-stage1-discussion.md` subject 4.
 */
export const property = /** @type {const} */([':', exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Properties

/** An object entry: a plain `property`, or a `spread` splicing another object in. */
export const properties = or(property, spread)

/** @typedef {Assert<Check<Properties, typeof properties>>} _Properties */

// Object — same nesting as `array` above, one position further in

/**
 * ```js
 * {
 *     a: exp0,
 *     "a": exp1,
 *     [exp2]: exp3,
 *     ...exp4,
 * }
 * ```
 *
 * The entries are an ordered sequence, applied as if in written order —
 * never sorted or deduplicated: order is observable (enumeration,
 * overwrites), and duplicate keys are allowed with the later entry winning,
 * which is also required once computed keys are admitted, since key
 * equality may not be decidable at validation time.
 *
 * `__proto__` is a data key, never a prototype assignment: an entry whose
 * key evaluates to `__proto__` defines an ordinary own property, and a
 * printer must spell it computed — `{ ["__proto__"]: value }`, the only
 * object-literal form that reproduces it; the identifier and string
 * spellings assign a prototype instead and lose the property. See "the
 * `__proto__` key" in `../../spec/README.md`.
 */
export const object = /** @type {const} */(['{}', rttiArray(properties)])

/** @typedef {Assert<Check<Object, typeof object>>} _Object */

// Number

/**
 * ```js
 * Number(exp)
 * ```
 */
export const numberCast = /** @type {const} */(['Number', exp])

/**
 * @typedef {Assert<Check<NumberCast, typeof numberCast>>} _NumberCast
 */

// Index

/**
 * A property/index operand: a plain `string` or `number` key, or a `Number`
 * cast around a computed `exp` (`arr[i]`, where `i` is itself an expression).
 *
 * Does not exclude `'constructor'`/`'__proto__'` — TODO, see
 * `../types/rtti/todo/excluded-string-values.md`.
 */
export const index = or(numberCast, string, number)

// Property Accessor

/**
 * ```js
 * exp0[exp1]
 * exp0.exp1
 * ```
 */
export const propertyAccessor = /** @type {const} */(['.', exp, index])

/**
 * @typedef {Assert<Check<PropertyAccessor, typeof propertyAccessor>>} _PropertyAccessor
 */

// Lambdas — grouped by operand shape, like `op1`/`op2`

/**
 * The two property steps, told apart by their tag: `|.` is
 *
 * ```js
 * a.exp0   // the `.exp0` step of a chain whose current value is `a`
 * ```
 *
 * and `|?.` the optional `a?.exp0`. Both take the current chain value as
 * their input and an `index` as their only operand, so they are one schema —
 * the same rule that groups `op1`/`op2` by operand count rather than by what
 * each id means.
 *
 * A property step reads the current value's property and makes that value the
 * receiver (`this`) of a later call step. `|?.` additionally short-circuits:
 * on a nullish input it produces `undefined`, leaves its `index` operand
 * unevaluated, and skips the remaining steps of the `lambdas` containing it.
 */
export const lambdaPropertyAccessorId = or('|.', '|?.')

/**
 * @typedef {Assert<Check<LambdaPropertyAccessorId, typeof lambdaPropertyAccessorId>>} _LambdaPropertyAccessorId
 */

export const lambdaPropertyAccessor = /** @type {const} */([lambdaPropertyAccessorId, index])

/**
 * @typedef {Assert<Check<LambdaPropertyAccessor, typeof lambdaPropertyAccessor>>} _LambdaPropertyAccessor
 */

/**
 * The two call steps, told apart by their tag: `|()` is
 *
 * ```js
 * a(...exp0)   // the `(...exp0)` step of a chain whose value is `a`
 * ```
 *
 * and `|?.()` the optional `a?.(...exp0)`. Both take one `exp` operand
 * evaluating to the complete argument array — the same convention as `call` —
 * so, like the property steps above, they are one schema.
 *
 * A call step calls the current value with the current receiver, if a
 * property step established one, and clears it. `|?.()` short-circuits the
 * same way `|?.` does, on a nullish current value, leaving its argument
 * operand unevaluated.
 */
export const lambdaCallId = or('|()', '|?.()')

/** @typedef {Assert<Check<LambdaCallId, typeof lambdaCallId>>} _LambdaCallId */

export const lambdaCall = /** @type {const} */([lambdaCallId, exp])

/** @typedef {Assert<Check<LambdaCall, typeof lambdaCall>>} _LambdaCall */

/**
 * One structural step of a chain: a function of the current chain value with
 * its argument elided, which is what makes it a *lambda* rather than an
 * operation over operands. It is **not** an `exp` — it takes its input
 * implicitly, so it needs no operand for it, and it cannot be lifted out as
 * a shared computation node: `['|.', 'b']` means nothing on its own, only as
 * the n-th step of some `lambdas`.
 *
 * The two property steps establish a receiver, the two call steps consume
 * one; the two optional ids additionally short-circuit. None of the four
 * carries a continuation operand — the rest of the chain is simply the rest
 * of the `lambdas` they sit in.
 */
export const lambda = or(lambdaPropertyAccessor, lambdaCall)

/** @typedef {Assert<Check<Lambda, typeof lambda>>} _Lambda */

/**
 * The rest of a chain, as a flat array of steps — the operand `call`,
 * `optionalPropertyAccessor`, and `optionalCall` use to spell out the
 * hidden control flow (HCF) of a JS member chain: the receiver a property
 * access carries into a following call as `this`, and the region an
 * optional link short-circuits.
 *
 * Both kinds of HCF live **only** in an operator's interpretation of a
 * `lambdas`, never in a value. Every `exp` evaluates to an ordinary value and nothing else: no
 * `exp` yields a receiver or a short-circuit state, so ordinary nodes stay
 * context-independent and shareable by identity as always.
 *
 * Evaluating a `lambdas` carries a current value and, optionally, a
 * receiver for it:
 *
 * ```text
 * a          current = a
 * |.b   ->   current = a.b,   this = a
 * |.c   ->   current = a.b.c, this = a.b
 * |()   ->   current = a.b.c(...) with this = a.b, and no receiver after
 * ```
 *
 * An optional step whose input is nullish produces `undefined` and skips
 * every step after it in **that same array**. A grouped subexpression ends
 * the region — `(a?.b).c` is a `.` over a complete `['?.', a, 'b', []]`, so
 * it throws where `a?.b.c` does not — which is exactly the distinction a
 * flat array of steps per region expresses.
 *
 * The empty `lambdas` does nothing: no further chain work, no receiver.
 */
export const lambdas = rttiArray(lambda)

/** @typedef {Assert<Check<Lambdas, typeof lambdas>>} _Lambdas */

// Call

/**
 * ```js
 * exp0(...exp2)              // ['()', exp0, [], exp2]
 * exp0.k(...exp2)            // ['()', exp0, [['|.', 'k']], exp2]
 * (exp0?.k)(...exp2)         // ['()', exp0, [['|?.', 'k']], exp2]
 * ```
 *
 * The one call operator: it evaluates `exp0`, runs the `lambdas`, then calls
 * the value that lambdas arrived at. Whether the call keeps a `this` binding
 * is decided by that `lambdas` alone — a trailing property step leaves a
 * receiver and the call is a method call, an empty `lambdas` (or one ending
 * in a call step) leaves none and the call is an ordinary one. There is no
 * separate `.()` node and no "with this" tag: `a.b(...c)` is this operator
 * over `[['|.', 'b']]`, and the same operator spells receiver chains no
 * dedicated property-plus-call form could, such as `(a?.(...b)?.c)(...d)`.
 *
 * The last operand is one node evaluating to the complete argument array,
 * not a literal operand list: `f(a, b)` is `['()', f, [], ['[]', [a, b]]]`,
 * while spread `f(...xs)` is `['()', f, [], xs]`.
 */
export const call = /** @type {const} */(['()', exp, lambdas, exp])

/** @typedef {Assert<Check<Call, typeof call>>} _Call */

// Optional Property Accessor

/**
 * ```js
 * exp0?.exp1                 // ['?.', exp0, exp1, []]
 * exp0?.exp1.k               // ['?.', exp0, exp1, [['|.', 'k']]]
 * ```
 *
 * Optional property access, owning the rest of its optional region as a
 * `lambdas`. If `exp0` is nullish the result is `undefined` and neither the
 * `index` nor any step of the `lambdas` is evaluated — in particular
 * `a?.[k]` does not evaluate `k`. Otherwise the `lambdas` runs with
 * `exp0[exp1]` as the current value and `exp0` as the receiver, and the
 * node's result is whatever it arrives at — an ordinary value, receiver
 * state never escaping it.
 *
 * Where the region ends is the grouping: `a?.b.c` is one node,
 * `['?.', a, 'b', [['|.', 'c']]]`, while `(a?.b).c` is a `.` node over a
 * complete `['?.', a, 'b', []]` — and throws when `a` is nullish, as JS does.
 */
export const optionalPropertyAccessor = /** @type {const} */(['?.', exp, index, lambdas])

/**
 * @typedef {Assert<Check<OptionalPropertyAccessor, typeof optionalPropertyAccessor>>} _OptionalPropertyAccessor
 */

// Optional Call

/**
 * ```js
 * exp0?.(...exp2)            // ['?.()', exp0, [], exp2, []]
 * (exp0?.k)?.(...exp2).m     // ['?.()', exp0, [['|?.', 'k']], exp2, [['|.', 'm']]]
 * ```
 *
 * Optional call. Like `call`, the first `lambdas` runs before the call and
 * may leave the receiver it is made with; unlike `call`, the callee is
 * checked first: if the value that `exp` plus that first `lambdas` arrives
 * at is nullish, the result is `undefined` and neither the arguments nor the
 * second `lambdas` is evaluated. That second one is the rest of the optional
 * region, run on the call's result — the counterpart of the one
 * `optionalPropertyAccessor` owns.
 */
export const optionalCall = /** @type {const} */(['?.()', exp, lambdas, exp, lambdas])

/** @typedef {Assert<Check<OptionalCall, typeof optionalCall>>} _OptionalCall */

// Comma

/**
 * ```js
 * (exp0, exp1, exp2)
 * ```
 *
 * Establishes all of its operands and takes the value of the last one; the
 * earlier operands exist for their throw-potential only. The shape is a
 * known-incomplete placeholder — it cannot yet say "at least two operands,
 * last is the result, each pre-result operand a true root (not reachable
 * from another operand of the same `,`)". A single-operand `,` is the
 * identity and a reachable operand a redundant anchor — both non-canonical,
 * each splitting one function into two hashes. See the header of
 * `./proof.f.mjs`.
 */
export const comma = /** @type {const} */([',', exps])

/**
 * @typedef {Assert<Check<Comma, typeof comma>>} _Comma
 */

// No-Args Operations

/**
 * `op0`/`op1`/`op2` group operation nodes by their `exp`-operand count —
 * zero, one, or two — not by any semantic category. `undefined`/`args`/
 * `frame` all take zero `exp` operands after the tag, so all three are
 * `op0`, regardless of what each individually means: the `undefined` value,
 * the arguments array, and the captured-consts frame — the way `args` is
 * for the arguments.
 */
export const op0Id = or('undefined', 'args', 'frame')

/** @typedef {Assert<Check<Op0Id, typeof op0Id>>} _Op0Id */

export const op0 = /** @type {const} */([op0Id])

/** @typedef {Assert<Check<Op0, typeof op0>>} _Op0 */

// Unary Operations

/**
 * `String`/`Number` are casts, `neg` is arithmetic negation (a word tag —
 * `-` is binary subtraction), `!` is logical and `~` bitwise not.
 */
export const op1Id = or('String', 'Number', 'neg', '!', '~')

/** @typedef {Assert<Check<Op1Id, typeof op1Id>>} _Op1Id */

export const op1 = /** @type {const} */([op1Id, exp])

/** @typedef {Assert<Check<Op1, typeof op1>>} _Op1 */

// Binary Operations

/**
 * `=>` builds a function from a frame and a body: the frame operand is one
 * node evaluated in the enclosing scope, while the body is the inner
 * function's graph — deferred, never established when the closure is built,
 * only on each call, against that function's own `args`/`frame`. Calling one
 * is not here: a call carries a `lambdas` operand, so it is not binary — see
 * the `call` export for `['()', exp, lambdas, exp]` and what that operand
 * decides. `own` is exactly
 * `Object.getOwnPropertyDescriptor(object, key)?.value` — no
 * getter invocation, no prototype chain — where the key operand must
 * evaluate to a string: a runtime-value constraint the shape-only schema
 * cannot express — a computed key's value is only known at execution, so
 * upholding it falls to the executor (`ownJs` in `./proof.f.mjs`; the
 * Operations table in `../../todo/edag-stage1-discussion.md`). The rest
 * are the JS comparison,
 * arithmetic, bitwise, and logical operators they name — with `&&`/`||`/`??`
 * short-circuiting exactly as in JS: their right operand is conditional,
 * never established eagerly. All this laziness is positional, not nodal —
 * the same node referenced from an eager position elsewhere is still
 * evaluated there.
 */
export const op2Id = or(
    '=>', 'own',
    '===', '!==', '>', '>=', '<', '<=',
    '+', '-', '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??'
)

/** @typedef {Assert<Check<Op2Id, typeof op2Id>>} _Op2Id */

export const op2 = /** @type {const} */([op2Id, exp, exp])

/** @typedef {Assert<Check<Op2, typeof op2>>} _Op2 */
