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
 *  Object,
 *  Dot,
 *  Call,
 *  DotCall,
 *  OptionDot,
 *  OptionCall,
 *  LambdaPropertyAccessorId,
 *  LambdaPropertyAccessor,
 *  LambdaCallId,
 *  LambdaCall,
 *  Lambda,
 *  Lambdas,
 *  OptionChain,
 *  OptionChainCall,
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
 * The chain nodes, the `lambda` steps, and `op0`/`op1`/`op2` (like
 * `array`/`object`) are open on trailing/extra elements — see "Structs and
 * tuples are open" in `../types/rtti/README.md`. Exact arity is spellable
 * with `close` there ("Closed containers"), not applied to these nodes yet.
 * No operand of any node here is optional.
 *
 * `validate(exp)` is shape validation only, and the walkers need more than
 * shape: their cardinality and minimality conditions are not statable with
 * `array(lambda)`, so `canonical` in `./canonical/module.f.mjs` carries them
 * and `validate` accepts graphs a lowering must never emit.
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
 *  typeof dot,
 *  typeof call,
 *  typeof dotCall,
 *  typeof optionDot,
 *  typeof optionCall,
 *  typeof optionChain,
 *  typeof optionChainCall,
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
    dot,
    call,
    dotCall,
    optionDot,
    optionCall,
    optionChain,
    optionChainCall,
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

// Dot

/**
 * ```js
 * exp0[exp1]
 * exp0.exp1
 * ```
 *
 * A property access and nothing else. The value it reads is an ordinary one:
 * the receiver a JS property reference also carries is *not* here, which is
 * why `(0, a.b)(...c)` — the receiver-less call — is a `call` over a `dot`,
 * and `a.b(...c)` is the separate `dotCall` node below.
 */
export const dot = /** @type {const} */(['.', exp, index])

/** @typedef {Assert<Check<Dot, typeof dot>>} _Dot */

// Call

/**
 * ```js
 * exp0(...exp1)
 * (0, exp0.k)(...exp1)   // ['()', ['.', exp0, 'k'], exp1]
 * ```
 *
 * A call with **no** receiver: the callee is an ordinary value, so it is
 * invoked with `this` undefined. A method call is `dotCall`, which holds the
 * receiver in its own operands rather than recovering it from the callee's
 * tag — the two are told apart here by the tag, which is what lets both stay
 * pure nodes.
 *
 * The last operand is one node evaluating to the complete argument array,
 * not a literal operand list: `f(a, b)` is `['()', f, ['[]', [a, b]]]`,
 * while spread `f(...xs)` is `['()', f, xs]`.
 */
export const call = /** @type {const} */(['()', exp, exp])

/** @typedef {Assert<Check<Call, typeof call>>} _Call */

// Dot Call

/**
 * ```js
 * exp0.exp1(...exp2)
 * (exp0.exp1)(...exp2)
 * ```
 *
 * The one expression with no optional operator that carries hidden control
 * flow (HCF), and so the one non-optional node that needs more than a value
 * from its operands: `exp0` is the receiver the call is made with. It needs
 * no `lambdas` because that receiver is born and consumed inside the node —
 * a call ends a receiver's lifetime, so `a.b(...c).d` is a `dot` over this
 * node rather than a longer form. See "Chains" in `../README.md`.
 */
export const dotCall = /** @type {const} */(['.()', exp, index, exp])

/** @typedef {Assert<Check<DotCall, typeof dotCall>>} _DotCall */

// Option Dot

/**
 * ```js
 * exp0?.exp1
 * ```
 *
 * Optional property access, and nothing more: if `exp0` is nullish the result
 * is `undefined` and the `index` is not evaluated — in particular `a?.[k]`
 * does not evaluate `k`. Its short-circuit skips nothing beyond its own
 * operand, which is why it needs no `lambdas`; `a?.b.c`, whose region reaches
 * past this node, is `optionChain`.
 */
export const optionDot = /** @type {const} */(['?.', exp, index])

/** @typedef {Assert<Check<OptionDot, typeof optionDot>>} _OptionDot */

// Option Call

/**
 * ```js
 * exp0?.(...exp1)
 * ```
 *
 * An optional call of a value, with no property and so no receiver: if
 * `exp0` is nullish the result is `undefined` and the arguments are not
 * evaluated. It looks parallel to `dotCall` and is not — the optional
 * *method* call `a?.b(...c)` is `optionChain`, because its region extends
 * past the access into the call.
 */
export const optionCall = /** @type {const} */(['?.()', exp, exp])

/** @typedef {Assert<Check<OptionCall, typeof optionCall>>} _OptionCall */

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
 * The `|` prefix is a correctness requirement rather than a readability one.
 * Tuples are open ("Caveats" in `../README.md`), so an unprefixed step
 * `['.', index]` would also admit a full three-operand `.` **node**, after
 * which a walk would read the node's base as its index. The prefix keeps the
 * two vocabularies disjoint, and marks what the disjointness is for.
 */
export const lambda = or(lambdaPropertyAccessor, lambdaCall)

/** @typedef {Assert<Check<Lambda, typeof lambda>>} _Lambda */

/**
 * One optional region, as a flat array of steps — the operand the two
 * walkers `optionChain` and `optionChainCall` carry. A region is the hidden
 * control flow (HCF) no fixed number of operands can hold, because the run
 * of operations an optional link skips is unbounded: `a?.b(...c).d.e…`.
 *
 * A `lambdas` is a necessary impurity and confined to those two nodes.
 * Whatever a graph expresses as a step is not a node — it cannot be shared,
 * cannot be substituted for an equivalent expression, and contributes no
 * hash of its own — so the five pure nodes hold every chain whose HCF is
 * complete within them, and a `lambdas` starts only where a region does.
 *
 * Evaluating one carries a current value and, optionally, a receiver for it:
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
 * the region — `(a?.b).c` is a `.` over a complete `['?.', a, 'b']`, so it
 * throws where `a?.b.c` does not — which is exactly the distinction one flat
 * array of steps per region expresses.
 */
export const lambdas = rttiArray(lambda)

/** @typedef {Assert<Check<Lambdas, typeof lambdas>>} _Lambdas */

// Option Chain

/**
 * ```js
 * a?.b.c          // ['_', a, [['|?.', 'b'], ['|.', 'c']]]
 * a?.b(...c)      // ['_', a, [['|?.', 'b'], ['|()', c]]]
 * a.b?.(...c)     // ['_', a, [['|.', 'b'], ['|?.()', c]]]
 * ```
 *
 * A walked optional region whose value is the node's own: it evaluates the
 * base, walks the `lambdas`, and reads what the walk arrived at. A
 * short-circuit inside the walk turns back into the value `undefined` here,
 * which is why `u?.b(d)` is `undefined` where `(u?.b)(d)` throws.
 *
 * Two conditions bound it, neither expressible in the schema — `array(T)`
 * states no cardinality and no order — so they are lowering rules checked by
 * `canonical` in `./canonical/module.f.mjs`: **at least two steps, at least
 * one of them optional**, and **minimality**, the shortest valid form. See
 * "Chains" in `../README.md`.
 */
export const optionChain = /** @type {const} */(['_', exp, lambdas])

/** @typedef {Assert<Check<OptionChain, typeof optionChain>>} _OptionChain */

// Option Chain Call

/**
 * ```js
 * (a?.b)(...c)      // ['_()', a, [['|?.', 'b']], c]
 * (a?.b.c)(...d)    // ['_()', a, [['|?.', 'b'], ['|.', 'c']], d]
 * ```
 *
 * The same walk, with the region's value **called** rather than read, using
 * the receiver its last step left. That makes it the only unguarded consumer
 * of a receiver, so a leading optional step is observable here and
 * irreducible: `(a?.b)(...c)` throws on a nullish `a` where `a?.b(...c)` is
 * `undefined`.
 *
 * Its conditions are `optionChain`'s with one step fewer required — **at
 * least one step, at least one of them optional** — plus minimality, which
 * here also requires the last step to be a property step: a trailing call
 * step has already cleared the receiver, leaving the node's own call nothing
 * to consume, and `['()', …]` spells that.
 */
export const optionChainCall = /** @type {const} */(['_()', exp, lambdas, exp])

/**
 * @typedef {Assert<Check<OptionChainCall, typeof optionChainCall>>} _OptionChainCall
 */

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
 * is not here even though `['()', exp, exp]` has two `exp` operands: `()` is
 * a member of the chain vocabulary — `.`, `()`, `.()`, `?.`, `?.()`, `_`,
 * `_()`, read together, where composition within a tag is evaluation order —
 * and its handler is the receiver machinery `.()` and `_()` share, not an
 * operator over two values the way every id here is. `own` is exactly
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
