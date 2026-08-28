/**
 * @module
 *
 * @import { Exp, OptionLambda, OptionPropertyLambda } from './types.ts'
 * @import { Phantom } from '../types/phantom/types.ts'
 */

import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray,
} from "../rtti/module.f.mjs";

/**
 * Every tuple here is closed — the members it declares and nothing else, which
 * is what a bare `Tuple` says ("Structs and tuples are closed" in
 * `../rtti/README.md`). That is load-bearing rather than incidental: the
 * chain grammar below claims each JS chain has exactly one spelling, and an
 * `open` tuple would let any node carry a trailing element nothing reads,
 * splitting one function into unboundedly many graphs. So do **not** wrap any
 * of these in `open`. No operand of any node is optional either: a chain step
 * that does no further work carries an explicit `null` continuation, never a
 * missing position.
 *
 * Do not call `parse(exp)` or rely on `validate(exp)` rejecting cycles
 * without reading `../rtti/todo/identity-aware-parse.md` first —
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
 *  typeof optionDot,
 *  typeof optionCall,
 *  typeof comma,
 *  typeof op2,
 *  typeof op1,
 *  typeof op0,
 * ]}
 */
export const _exp = () => (['or',
    primitive,
    array,
    object,
    dot,
    call,
    optionDot,
    optionCall,
    comma,
    op2,
    op1,
    op0,
])

/** @type {Phantom<typeof _exp, Exp>} */
export const exp = _exp

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

// Exps

export const exps = rttiArray(exp)

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
export const spread = /** @type {const} */ (['...', exp])

// Items

/** An array element: a plain `exp`, or a `spread` splicing another array in. */
export const items = or(exp, spread)

// Array

/**
 * ```js
 * [exp0, exp1]
 * [exp0, ...exp1]
 * ```
 */
export const array = /** @type {const} */ (['[]', rttiArray(items)])

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
export const property = /** @type {const} */ ([':', exp, exp])

// Properties

/** An object entry: a plain `property`, or a `spread` splicing another object in. */
export const properties = or(property, spread)

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
export const object = /** @type {const} */ (['{}', rttiArray(properties)])

// Number

/**
 * ```js
 * Number(exp)
 * ```
 */
export const numberCast = /** @type {const} */ (['Number', exp])

// Index

/**
 * A property/index operand: a plain `string` or `number` key, or a `Number`
 * cast around a computed `exp` (`arr[i]`, where `i` is itself an expression).
 *
 * Every naming position in the chain nodes below uses this rather than a bare
 * `exp` — `.`, `?.`, and the `|.` step. Widening them to `exp` was weighed and
 * rejected: `exp` and `index` overlap (`['Number', e]` is both a `numberCast`
 * and an `op1`), so the wider spelling would buy a second reading of every
 * computed key without buying any expression a `Number` cast cannot already
 * name.
 *
 * Does not exclude `'constructor'`/`'__proto__'` — TODO, see
 * `../rtti/todo/excluded-string-values.md`.
 */
export const index = or(numberCast, string, number)

// Chain lambdas

// A JS member chain carries two bits of hidden control flow that no value
// carries: **P**, a receiver handed from a property access to a following
// call, and **O**, a short-circuit region opened by an optional operator.
// Neither bit live is the definition of a node boundary, so the three states
// in which a chain can continue are exactly three lambda types — the fourth
// cell of the table is an ordinary `Exp`:
//
// ```text
//                    outside an option   inside an option
// receiver live      propertyLambda      optionPropertyLambda
// value only         (an exp)            optionLambda
// ```
//
// A lambda is **not** an `exp`: it reads the chain's current value implicitly,
// so it has no operand to hold one, and it cannot be lifted out as a shared
// computation node — `['|.', 'b', null]` means nothing on its own, only as
// the continuation of some chain node. That is the standing cost of this
// shape: the receiver a step consumes cannot be shared, substituted, or
// hashed.
//
// Four steps, each a transition on the two bits:
//
// ```text
// |.      sets P, keeps O     a property access produces a receiver
// |()     clears P, keeps O   a call consumes it
// |?.()   clears P, sets O    a call consumes it and opens a region
// |!()    clears P, clears O  a call consumes it and closes the region
// ```
//
// Every tag carries the `|` prefix, and that is a correctness requirement
// rather than a readability one. Unprefixed, `['()', f, null]` would be
// simultaneously a well-formed `call` — call `f` with `null` as its arguments
// — and a well-formed `optionLambda` — call the chain's value with `f` as its
// arguments, and stop. The two readings have the same length, so closedness
// cannot separate them; only disjoint vocabularies can.
//
// A production exists in a state exactly when moving that step into a nested
// node would be **observable**, which is why the same step appears in one
// state and not another. The sharpest case is `|.`: it is in
// `optionPropertyLambda` and not in `propertyLambda`, though it wastes a
// receiver either way — the difference is that O is live in one, and a region
// does not let a step leave. That single asymmetry is what makes `(a?.b).c`
// throw where `a?.b.c` does not.

/**
 * The continuation of a step that produced a plain value **inside** an open
 * region — what `?.()` owns, and what a call step hands on.
 *
 * `|()` stays in the region because the region has to cover the call:
 * `a?.(...b)(...c)` skips the second call too. `|.` stays for the same
 * reason, and hands on a receiver. Neither `|?.()` nor `|!()` is here: with P
 * dead there is nothing for a guard or a close to protect that a nested node
 * would not protect equally, so admitting them would only add a second
 * spelling.
 *
 * @type {() => readonly['or',
 *  null,
 *  readonly['|()', typeof exp, typeof optionLambda],
 *  readonly['|.', typeof index, typeof optionPropertyLambda],
 * ]}
 */
export const _optionLambda = () => (['or',
    null,
    /** @type {const} */ (['|()', exp, optionLambda]),
    /** @type {const} */ (['|.', index, optionPropertyLambda]),
])

/** @type {Phantom<typeof _optionLambda, OptionLambda>} */
export const optionLambda = _optionLambda

/**
 * The continuation of a property step **inside** an open region — both bits
 * live, so this is the state with every production.
 *
 * Its three call forms are a complete taxonomy of how a call can relate to
 * the region around it, and there is no fourth:
 *
 * ```js
 * a?.b(...c)     // ['?.', a, 'b', ['|()',   c, null]]  inherits the guard
 * a?.b?.(...c)   // ['?.', a, 'b', ['|?.()', c, null]]  adds its own
 * (a?.b)(...c)   // ['?.', a, 'b', ['|!()',  c, null]]  escapes it
 * ```
 *
 * `|!()` is the one step a short-circuit does not skip: the parentheses ended
 * the region, so the `undefined` it produced is what gets called. `|!` pairs
 * only with `()` because only a call consumes a receiver — a close-then-access
 * `|!.` would just be a `dot` over the whole node, which nesting already
 * spells.
 *
 * @type {() => readonly['or',
 *  null,
 *  readonly['|()', typeof exp, typeof optionLambda],
 *  readonly['|.', typeof index, typeof optionPropertyLambda],
 *  readonly['|?.()', typeof exp, typeof optionLambda],
 *  readonly['|!()', typeof exp, null],
 * ]}
 */
export const _optionPropertyLambda = () => (['or',
    null,
    /** @type {const} */ (['|()', exp, optionLambda]),
    /** @type {const} */ (['|.', index, optionPropertyLambda]),
    /** @type {const} */ (['|?.()', exp, optionLambda]),
    /** @type {const} */ (['|!()', exp, null]),
])

/** @type {Phantom<typeof _optionPropertyLambda, OptionPropertyLambda>} */
export const optionPropertyLambda = _optionPropertyLambda

/**
 * The continuation of a `dot` — a receiver is live and no region is open.
 *
 * Only the two call steps are here, because only a call can use a receiver.
 * `|()` is terminal: with the receiver spent and no region to be inside, what
 * follows an `a.b(...c)` is an ordinary expression over an ordinary value, so
 * it nests. `|?.()` continues, since it opens a region that then owns the
 * rest of the chain. There is no `|.` production, which is what gives a plain
 * property path exactly one spelling: `a.b.c` is nested `dot`s and nothing
 * else.
 *
 * The terminal's third operand is a literal `null`, not the absence of one.
 * Uniform arity is what keeps closedness able to tell it from `['|()', c, k]`:
 * were the terminal two elements long, a continuation handed to a
 * `propertyLambda` slot would be read as the terminal with the rest silently
 * dropped.
 */
export const propertyLambda = or(
    null,
    /** @type {const} */ (['|()', exp, null]),
    /** @type {const} */ (['|?.()', exp, optionLambda]),
)

// Call

/**
 * ```js
 * exp0(...exp1)
 * ```
 *
 * A call with **no** receiver and no region: the callee is an ordinary
 * expression, so a chain never reaches this node — `a.b(...c)` is a `dot`
 * whose continuation is the call, and `(0, a.b)(...c)` is this node over a
 * complete `dot`. The two differ, which is why the distinction is structural.
 *
 * The last operand is one node evaluating to the complete argument array,
 * not a literal operand list: `f(a, b)` is `['()', f, ['[]', [a, b]]]`,
 * while spread `f(...xs)` is `['()', f, xs]`.
 */
export const call = /** @type {const} */ (['()', exp, exp])

// Dot

/**
 * ```js
 * exp0.k                     // ['.', exp0, 'k', null]
 * exp0[exp1]                 // ['.', exp0, ['Number', exp1], null]
 * exp0.k(...exp2)            // ['.', exp0, 'k', ['|()', exp2, null]]
 * exp0.k?.(...exp2)          // ['.', exp0, 'k', ['|?.()', exp2, null]]
 * ```
 *
 * The naming operand is an `index`, not an `exp`, so a computed key is spelled
 * `['Number', exp]`: `['.', a, ['args'], null]` does not validate.
 *
 * Property access, owning whatever the receiver it produces is used for. The
 * `null` continuation is the plain read — the receiver is dropped, as JS
 * drops it — and the two call continuations are the only things that can use
 * it.
 */
export const dot = /** @type {const} */ (['.', exp, index, propertyLambda])

// Option Dot

/**
 * ```js
 * exp0?.k                    // ['?.', exp0, 'k', null]
 * exp0?.[exp1]               // ['?.', exp0, ['Number', exp1], null]
 * exp0?.k.m                  // ['?.', exp0, 'k', ['|.', 'm', null]]
 * (exp0?.k)(...exp2)         // ['?.', exp0, 'k', ['|!()', exp2, null]]
 * ```
 *
 * Optional property access, owning the rest of its optional region. If `exp0`
 * is nullish the region short-circuits: neither the `index` nor any step of
 * the continuation is evaluated — in particular `a?.[k]` does not evaluate
 * `k` — and the node's value is `undefined`, unless the continuation reaches
 * a `|!()`, which the parentheses put *outside* the region and which
 * therefore calls that `undefined`.
 *
 * Where the region ends is the grouping: `a?.b.c` is one node,
 * `['?.', a, 'b', ['|.', 'c', null]]`, while `(a?.b).c` is a `dot` over a
 * complete `['?.', a, 'b', null]` — and throws when `a` is nullish, as JS
 * does.
 */
export const optionDot = /** @type {const} */ (['?.', exp, index, optionPropertyLambda])

// Option Call

/**
 * ```js
 * exp0?.(...exp1)            // ['?.()', exp0, exp1, null]
 * exp0?.(...exp1).k          // ['?.()', exp0, exp1, ['|.', 'k', null]]
 * ```
 *
 * Optional call, owning the rest of its optional region the way `?.` does.
 * The callee is an ordinary expression, so this node never carries a receiver
 * — `a.b?.(...c)` is a `dot` with a `|?.()` continuation, not this. If `exp0`
 * is nullish the arguments are not evaluated and the region short-circuits.
 */
export const optionCall = /** @type {const} */ (['?.()', exp, exp, optionLambda])

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
export const comma = /** @type {const} */ ([',', exps])

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

export const op0 = /** @type {const} */ ([op0Id])

// Unary Operations

/**
 * `String`/`Number` are casts, `neg` is arithmetic negation (a word tag —
 * `-` is binary subtraction), `!` is logical and `~` bitwise not.
 */
export const op1Id = or('String', 'Number', 'neg', '!', '~')

export const op1 = /** @type {const} */ ([op1Id, exp])

// Binary Operations

/**
 * `=>` builds a function from a frame and a body: the frame operand is one
 * node evaluated in the enclosing scope, while the body is the inner
 * function's graph — deferred, never established when the closure is built,
 * only on each call, against that function's own `args`/`frame`. Calling one
 * is not here: `()` is `['()', exp, exp]` and so *is* binary in operand
 * count, but it is a chain node rather than an operation — the whole point of
 * the chain vocabulary is that a call's receiver comes from the node holding
 * it, which no `op2` id has anywhere to put. `own` is exactly
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

export const op2 = /** @type {const} */ ([op2Id, exp, exp])
