/**
 * Recursive schemas use already-bound self thunks, rather than capture a later
 * declaration. Their accepted values and public export names stay the same;
 * expanding a thunk may create fresh internal descriptors and different rule labels.
 *
 * @module
 *
 * @import { Exp, HelperId, IntrinsicId, ItemsOver, OptionLambda, OptionPropertyLambda, Plain, StaticId, StepOver } from './types.ts'
 * @import { Phantom } from '../types/phantom/types.ts'
 * @import { _OptionLambdaSchema, _OptionPropertyLambdaSchema } from './private.ts'
 */

import {
    bigint,
    boolean,
    number,
    or,
    string,
    array as rttiArray,
} from "../rtti/module.f.js";
import { isArray } from '../types/array/module.f.js'

/**
 * Every tuple here is closed — the members it declares and nothing else, which
 * is what a bare `Tuple` says ("Structs and tuples are closed" in
 * `../rtti/guide/schemas/closed-containers/README.md`). That is load-bearing
 * rather than incidental: the chain grammar below claims each JS chain has
 * exactly one spelling, and an `open` tuple would let any node carry a
 * trailing element nothing reads,
 * splitting one function into unboundedly many graphs. So do **not** wrap any
 * of these in `open`. No operand of any node is optional either. A chain that
 * ends says so by **arity**: the step or node is simply the shorter tuple,
 * with no continuation position at all, and closedness by length is what
 * keeps the two arities apart — which is why each such kind is an `or` of
 * both rather than one tuple with an omittable tail.
 *
 * Do not call `parse(exp)` or rely on `validate(exp)` rejecting cycles
 * without reading `../rtti/todo/identity-aware-parse.md` first —
 * neither is identity-aware, and that TODO covers why and what's missing.
 */

// Leaf schemas precede the recursive builder; public exports keep their docs below.
const primitiveSchema = or(null, boolean, number, string, bigint)

const argSchema = /** @type {const} */ (['arg', number])

const frameSchema = /** @type {const} */ (['frame', number])

const staticNames = /** @type {const} */ (['Object.is', 'Object.entries', 'Object.keys', 'String.fromCharCode', 'Object.fromEntries', 'Number.isInteger', 'Number.isSafeInteger', 'Number.isNaN', 'Number.isFinite'])

const staticIdSchema = or(...staticNames)

const intrinsicDefinitions = /** @type {const} */ ([['slice', 3], ['charCodeAt', 2]])

const intrinsicNames = intrinsicDefinitions.map(([id]) => id)

const intrinsicIdSchema = or(...intrinsicNames)

const op0IdSchema = or('undefined', 'args', 'rest', 'self', 'entry', 'hasEntry', intrinsicIdSchema, staticIdSchema)

const op1IdSchema = or('String', 'Number', 'BigInt', 'Boolean', '!', '~', 'typeof', 'throw')

const op2IdSchema = or(
    '===', '!==', '>', '>=', '<', '<=',
    '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>'
)

const op12IdSchema = or('+', '-')

const op3IdSchema = or('?:')

const constructorIdSchema = or('Array')

/**
 * One level of the expression grammar, with an already-bound recursion anchor.
 * Option-property recursion owns a local option thunk, whose own self-reference
 * keeps repeated calls finite without capturing a later declaration.
 * @template {() => readonly ['or', ...readonly import('../rtti/types.ts').Type[]]} E
 * @param {E} expression
 */
const schemasFor = expression => {
    /** @type {Phantom<E, Exp>} */
    const exp = expression
    const op0Id = op0IdSchema
    const op1Id = op1IdSchema
    const op2Id = op2IdSchema
    const op12Id = op12IdSchema
    const op3Id = op3IdSchema
    const constructorId = constructorIdSchema

    const exps = rttiArray(exp)

    const func = /** @type {const} */ (['=>', number, exps, exp])

    const spread = /** @type {const} */ (['...', exp])

    const items = or(exp, spread)

    const array = /** @type {const} */ (['[]', rttiArray(items)])

    const args = rttiArray(items)

    const property = /** @type {const} */ ([':', exp, exp])

    const properties = or(property, spread)

    const object = /** @type {const} */ (['{}', rttiArray(properties)])

    const numberCast = /** @type {const} */ (['Number', exp])

    const index = or(numberCast, string, number)

    const memberPresent = /** @type {const} */ (['memberPresent', exp, index])

    /** @param {Phantom<_OptionLambdaSchema<Phantom<E, Exp>>, OptionLambda>} optionLambda
     * @param {Phantom<_OptionPropertyLambdaSchema<Phantom<E, Exp>>, OptionPropertyLambda>} optionPropertyLambda */
    const regionProductions = (optionLambda, optionPropertyLambda) => /** @type {const} */ ([
        /** @type {const} */ (['|()', args]),
        /** @type {const} */ (['|()', args, optionLambda]),
        /** @type {const} */ (['|.', index]),
        /** @type {const} */ (['|.', index, optionPropertyLambda]),
    ])

    /** @type {_OptionPropertyLambdaSchema<Phantom<E, Exp>>} */
    const optionPropertyLambdaSchema = () => {
        /** @type {_OptionLambdaSchema<Phantom<E, Exp>>} */
        const optionLambdaSchema = () => ['or', ...regionProductions(optionLambdaSchema, optionPropertyLambdaSchema)]
        return ['or', ...regionProductions(optionLambdaSchema, optionPropertyLambdaSchema),
            ['|?.()', args], ['|?.()', args, optionLambdaSchema], ['|!()', args]]
    }

    /** @type {Phantom<typeof optionPropertyLambdaSchema, OptionPropertyLambda>} */
    const optionPropertyLambda = optionPropertyLambdaSchema

    /** @type {_OptionLambdaSchema<Phantom<E, Exp>>} */
    const optionLambdaSchema = () => ['or', ...regionProductions(optionLambdaSchema, optionPropertyLambda)]

    /** @type {Phantom<typeof optionLambdaSchema, OptionLambda>} */
    const optionLambda = optionLambdaSchema

    const propertyLambda = or(
        /** @type {const} */ (['|()', args]),
        /** @type {const} */ (['|?.()', args]),
        /** @type {const} */ (['|?.()', args, optionLambda]),
    )

    const call = /** @type {const} */ (['()', exp, args])

    const dot = or(
        /** @type {const} */ (['.', exp, index]),
        /** @type {const} */ (['.', exp, index, propertyLambda]),
    )

    const optionDot = or(
        /** @type {const} */ (['?.', exp, index]),
        /** @type {const} */ (['?.', exp, index, optionPropertyLambda]),
    )

    const optionCall = or(
        /** @type {const} */ (['?.()', exp, args]),
        /** @type {const} */ (['?.()', exp, args, optionLambda]),
    )

    const comma = /** @type {const} */ ([',', exps])

    const op0 = /** @type {const} */ ([op0Id])

    const op1 = /** @type {const} */ ([op1Id, exp])

    const op2 = /** @type {const} */ ([op2Id, exp, exp])

    const op12 = or(
        /** @type {const} */ ([op12Id, exp]),
        /** @type {const} */ ([op12Id, exp, exp]),
    )

    const op3 = /** @type {const} */ ([op3Id, exp, exp, exp])

    const instanceOf = /** @type {const} */ (['instanceof', exp, constructorId])

    const inOp = /** @type {const} */ (['in', string, exp])

    return {
        exps, func, spread, items, array, args, property, properties, object, numberCast, index, memberPresent,
        propertyLambda, callNode: call, dot, optionDot, optionCall, comma, op0, op1, op2, op12, op3,
        instanceOf, inOp, _optionLambda: optionLambdaSchema, optionLambda,
        _optionPropertyLambda: optionPropertyLambdaSchema, optionPropertyLambda,
    }
}

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
 *  typeof op3,
 *  typeof op12,
 *  typeof op2,
 *  typeof op1,
 *  typeof op0,
 *  typeof instanceOf,
 *  typeof inOp,
 *  typeof memberPresent,
 *  typeof func,
 *  typeof arg,
 *  typeof frame,
 * ]}
 */
export const _exp = () => {
    const schemas = schemasFor(_exp)
    return ['or',
        primitiveSchema,
        schemas.array,
        schemas.object,
        schemas.dot,
        schemas.callNode,
        schemas.optionDot,
        schemas.optionCall,
        schemas.comma,
        schemas.op3,
        schemas.op12,
        schemas.op2,
        schemas.op1,
        schemas.op0,
        schemas.instanceOf,
        schemas.inOp,
        schemas.memberPresent,
        schemas.func,
        argSchema,
        frameSchema,
    ]
}

/** @type {Phantom<typeof _exp, Exp>} */
export const exp = _exp

const schemas = schemasFor(exp)

// Primitive

/**
 * Bare constant values — no tag, no operands, not an operation node at all.
 * `undefined` is deliberately not among them: its EDAG representation,
 * `['undefined']`, *is* a tagged operation node (so a bare `undefined` stays
 * distinguishable from a missing tuple position), which puts it in the
 * `op0`/`op1`/`op2` grouping below by the same arity rule as every other
 * operation, not here.
 */
export const primitive = primitiveSchema

/**
 * A plain value as fresh literal nodes. Present `undefined` properties stay
 * present, and object members follow enumeration order. Each occurrence gets
 * its own nodes; only `other`, which answers function leaves, can supply shared
 * nodes or nonliteral expressions. This encodes descriptions, not the identity
 * or reflected code of runtime objects and functions.
 *
 * @template {globalThis.Function} F
 * @param {(value: F) => Exp} other
 * @returns {(value: Plain<F>) => Exp}
 */
export const fromValue = other => {
    /** @type {(value: Plain<F>) => Exp} */
    const encode = value => {
        if (typeof value === 'function') { return other(value) }
        if (value === undefined) { return ['undefined'] }
        if (isArray(value)) { return ['[]', value.map(encode)] }
        if (value !== null && typeof value === 'object') {
            return ['{}', Object.entries(value).map(([key, member]) => [':', key, encode(member)])]
        }
        return value
    }
    return encode
}

// Exps

/** @type {() => readonly ['array', typeof exp]} */
export const exps = schemas.exps

// Function

/**
 * A function's fixed parameter count, the slots of its frame, and its
 * invocation body. Length is integer metadata, not an expression operand;
 * negative zero is invalid. The slots are an array operand, each an `exp`
 * evaluated in the enclosing scope when the function is built — `[]` for a
 * function that captures nothing — and never a spread, so that the count a
 * `frame` read is checked against is the array's length. Analysis and
 * operations check the metadata, while this schema checks tuple shape. Only
 * the body opens a new scope.
 */
/** @type {readonly ['=>', typeof number, typeof exps, typeof exp]} */
export const func = schemas.func
/** A constant fixed-position read; its index must be canonical and below the owning length. */
export const arg = argSchema
/**
 * A constant read of slot `N` of the owning function's frame — the value
 * the enclosing scope put at position `N` of the slots of `func`. The index
 * is metadata, as `arg`'s is: canonical and below the slot count, validated
 * by the analysis and the operations, since the frame as a whole is not a
 * value the body can name.
 */
export const frame = frameSchema

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
/** @type {readonly ['...', typeof exp]} */
export const spread = schemas.spread

// Items

/** An array element: a plain `exp`, or a `spread` splicing another array in. */
/** @type {() => readonly ['or', typeof exp, typeof spread]} */
export const items = schemas.items

// Array

/**
 * ```js
 * [exp0, exp1]
 * [exp0, ...exp1]
 * ```
 */
/** @type {readonly ['[]', () => readonly ['array', typeof items]]} */
export const array = schemas.array

// Args

/**
 * ```js
 * f(exp0, ...exp1)   // ['()', f, [exp0, ['...', exp1]]]
 * ```
 *
 * A call's arguments: the item list an `array` holds, read by position
 * rather than wrapped in a node, so the arguments are never a node of their
 * own. A spread item iterates its operand, `f(...'ab')` passing `'a'` and
 * `'b'`, and forwarding a rest parameter spreads it like any other operand,
 * `[['...', ['rest']]]`. A list whose first item is a string, `f('.', x)`, is
 * `['.', x]` here: the position, not a tag, says it is a list.
 *
 * The list means one array, which the callee splits into its fixed
 * parameters and its rest; an engine may build those two arrays directly
 * from the callee's `length` (`../README.md`, Nodes).
 */
/** @type {() => readonly ['array', typeof items]} */
export const args = schemas.args

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
/** @type {readonly [':', typeof exp, typeof exp]} */
export const property = schemas.property

// Properties

/** An object entry: a plain `property`, or a `spread` splicing another object in. */
/** @type {() => readonly ['or', typeof property, typeof spread]} */
export const properties = schemas.properties

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
/** @type {readonly ['{}', () => readonly ['array', typeof properties]]} */
export const object = schemas.object

// Number

/**
 * ```js
 * Number(exp)
 * ```
 */
/** @type {readonly ['Number', typeof exp]} */
export const numberCast = schemas.numberCast

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
/** @type {() => readonly ['or', typeof numberCast, typeof string, typeof number]} */
export const index = schemas.index

/**
 * Internal preargument member resolution. Evaluate the receiver and key, then
 * perform the full property read and existing optional-member-call guard.
 * The Boolean records presence, including native methods; it does not check
 * callability or invoke the member. The receiver and key remain available for
 * the subsequent member call. This operation has no source-language spelling.
 */
/** @type {readonly ['memberPresent', typeof exp, typeof index]} */
export const memberPresent = schemas.memberPresent

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
// computation node — `['|.', 'b']` means nothing on its own, only as
// the continuation of some chain node. That is the standing cost of this
// shape: the receiver a step consumes cannot be shared, substituted, or
// hashed.
//
// **Ending a chain** is spelled by arity, not by a terminator value: a step
// or node that hands the chain on carries its continuation as a last operand,
// and one that ends it is the same tuple one element shorter. So every kind
// that can end is an `or` of its two closed arities, `null` is a primitive
// again rather than a chain terminator, and a trailing hole — `['.', a, 'b', ,]`
// — matches neither arm: the short one is bounded by length, and the long one
// has no `option` member to admit an absent one.
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
// Every tag carries the `|` prefix, which keeps the step vocabulary disjoint
// from the node vocabulary: a tuple's tag alone says which grammar it belongs
// to. Unprefixed, `['()', x, y]` would read as a `call` — call `x` with the
// list `y` as its arguments — and as a step — call the chain's value with the
// list `x` as its arguments, then continue with `y`. Closedness bounds a tuple's length and
// says nothing about its tag, so no arity separates those readings; the
// prefix does, and does it without anyone having to prove that a continuation
// could never also be an expression.
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
 * Each production appears twice, once per **arity**: a step that hands the
 * chain on carries its continuation, and one that ends the chain is a
 * shorter tuple with no continuation position at all — see "Ending a chain"
 * above.
 *
 * @type {() => readonly ['or',
 *  readonly ['|()', typeof args],
 *  readonly ['|()', typeof args, typeof optionLambda],
 *  readonly ['|.', typeof index],
 *  readonly ['|.', typeof index, typeof optionPropertyLambda]]}
 */
export const _optionLambda = schemas._optionLambda

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
 * a?.b(...c)     // ['?.', a, 'b', ['|()',   c]]  inherits the guard
 * a?.b?.(...c)   // ['?.', a, 'b', ['|?.()', c]]  adds its own
 * (a?.b)(...c)   // ['?.', a, 'b', ['|!()',  c]]  escapes it
 * ```
 *
 * `|!()` is the one step a short-circuit does not skip: the parentheses ended
 * the region, so the `undefined` it produced is what gets called. `|!` pairs
 * only with `()` because only a call consumes a receiver — a close-then-access
 * `|!.` would just be a `dot` over the whole node, which nesting already
 * spells. It is also the one production with a single arity: closing the
 * region is terminal, so it never carries a continuation.
 *
 * @type {() => readonly ['or',
 *  readonly ['|()', typeof args],
 *  readonly ['|()', typeof args, typeof optionLambda],
 *  readonly ['|.', typeof index],
 *  readonly ['|.', typeof index, typeof optionPropertyLambda],
 *  readonly ['|?.()', typeof args],
 *  readonly ['|?.()', typeof args, typeof optionLambda],
 *  readonly ['|!()', typeof args]]}
 */
export const _optionPropertyLambda = schemas._optionPropertyLambda

/** @type {Phantom<typeof _optionPropertyLambda, OptionPropertyLambda>} */
export const optionPropertyLambda = _optionPropertyLambda

/**
 * The continuation of a `dot` — a receiver is live and no region is open.
 *
 * Only the two call steps are here, because only a call can use a receiver.
 * `|()` is terminal: with the receiver spent and no region to be inside, what
 * follows an `a.b(...c)` is an ordinary expression over an ordinary value, so
 * it nests — which is why it has only the shorter arity. `|?.()` continues,
 * since it opens a region that then owns the rest of the chain, so it has
 * both. There is no `|.` production, which is what gives a plain property
 * path exactly one spelling: `a.b.c` is nested `dot`s and nothing else.
 */
/** @type {() => readonly ['or',
 *  readonly ['|()', typeof args],
 *  readonly ['|?.()', typeof args],
 *  readonly ['|?.()', typeof args, typeof optionLambda]]} */
export const propertyLambda = schemas.propertyLambda

// Call

/**
 * ```js
 * exp0(exp1, ...exp2)   // ['()', exp0, [exp1, ['...', exp2]]]
 * ```
 *
 * A call with **no** receiver and no region: the callee is an ordinary
 * expression, so a chain never reaches this node — `a.b(...c)` is a `dot`
 * whose continuation is the call, and `(0, a.b)(...c)` is this node over a
 * complete `dot`. The two differ, which is why the distinction is structural.
 *
 * The last operand is the argument list, {@link args}: `f(a, b)` is
 * `['()', f, [a, b]]`, and spread `f(...xs)` is `['()', f, [['...', xs]]]`.
 *
 * One arity, unlike the three chain nodes below: `()` produces a bare value
 * and so has no continuation operand to leave out.
 */
/** @type {readonly ['()', typeof exp, typeof args]} */
export const call = schemas.callNode

// Dot

/**
 * ```js
 * exp0.k                     // ['.', exp0, 'k']
 * exp0[exp1]                 // ['.', exp0, ['Number', exp1]]
 * exp0.k(...exp2)            // ['.', exp0, 'k', ['|()', exp2]]
 * exp0.k?.(...exp2)          // ['.', exp0, 'k', ['|?.()', exp2]]
 * ```
 *
 * The naming operand is an `index`, not an `exp`, so a computed key is spelled
 * `['Number', exp]`: `['.', a, ['args']]` does not validate.
 *
 * Property access, owning whatever the receiver it produces is used for. The
 * three-element arity is the plain read — the receiver is dropped, as JS
 * drops it — and the two call continuations are the only things that can use
 * it.
 */
/** @type {() => readonly ['or',
 *  readonly ['.', typeof exp, typeof index],
 *  readonly ['.', typeof exp, typeof index, typeof propertyLambda]]} */
export const dot = schemas.dot

// Option Dot

/**
 * ```js
 * exp0?.k                    // ['?.', exp0, 'k']
 * exp0?.[exp1]               // ['?.', exp0, ['Number', exp1]]
 * exp0?.k.m                  // ['?.', exp0, 'k', ['|.', 'm']]
 * (exp0?.k)(...exp2)         // ['?.', exp0, 'k', ['|!()', exp2]]
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
 * `['?.', a, 'b', ['|.', 'c']]`, while `(a?.b).c` is a `dot` over a
 * complete `['?.', a, 'b']` — and throws when `a` is nullish, as JS does.
 */
/** @type {() => readonly ['or',
 *  readonly ['?.', typeof exp, typeof index],
 *  readonly ['?.', typeof exp, typeof index, typeof optionPropertyLambda]]} */
export const optionDot = schemas.optionDot

// Option Call

/**
 * ```js
 * exp0?.(exp1)            // ['?.()', exp0, [exp1]]
 * exp0?.(exp1).k          // ['?.()', exp0, [exp1], ['|.', 'k']]
 * ```
 *
 * Optional call, owning the rest of its optional region the way `?.` does.
 * The callee is an ordinary expression, so this node never carries a receiver
 * — `a.b?.(...c)` is a `dot` with a `|?.()` continuation, not this. If `exp0`
 * is nullish the arguments are not evaluated and the region short-circuits.
 */
/** @type {() => readonly ['or',
 *  readonly ['?.()', typeof exp, typeof args],
 *  readonly ['?.()', typeof exp, typeof args, typeof optionLambda]]} */
export const optionCall = schemas.optionCall

// Comma

/**
 * ```js
 * (exp0, exp1, exp2)
 * ```
 *
 * Establishes all of its operands and takes the value of the last one; the
 * earlier operands exist for their throw-potential only — the anchors of
 * computations whose value nothing takes. The shape says nothing of the
 * contract, which the emitter keeps: at least two operands, the last the
 * result, each earlier operand a true root, not reachable from another
 * operand of the same `,`. A single-operand `,` is the identity and a
 * reachable operand a redundant anchor — both non-canonical, each splitting
 * one function into two hashes. `fjs/compiler/edag` emits it for what a module's
 * export does not reach; see the Caveats of `./README.md`.
 */
/** @type {readonly [',', typeof exps]} */
export const comma = schemas.comma

// No-Args Operations

/**
 * The static functions' tags: each a path `../js/static` admits, its keys
 * joined by `.`, which `./types.ts` pins to that list — `Object.is` for
 * `['Object', 'is']`, `Number.isInteger` for `['Number', 'isInteger']`.
 */
export const staticIds = staticNames

/**
 * A static function as a value, `['Object.is']`: the function the
 * runtime's `static` answers for the id, `runtime.static('Object.is')`,
 * capturing nothing and called as any function is,
 * `['()', ['Object.is'], [a, b]]`. Unlike `entry` it is one function, not
 * fresh where it is established — `Object.is === Object.is` holds in
 * JavaScript — so two occurrences merge, and an executor answers the same
 * function on every read: its own native binding, or the body the runtime
 * its context carries holds, and with neither it fails naming it rather
 * than answer.
 */
export const staticId = staticIdSchema

/**
 * Whether a node — the EDAG's, or the AST's, which shares it — is a static
 * function, `['Object.is']`: one tag of {@link staticIds} and nothing
 * else. What reads a static node asks this, before its `switch` on the
 * tag, instead of listing the tags again, so a new static is a row of the
 * list, and nowhere a missed `case` would read it as something else. Two
 * places name every tag still, each one `tsc` holds to the list, a
 * missing tag a type error: the analysis's table of handlers, keyed by
 * every tag, and the interpreter's `switch`, where `Op0` is one tuple
 * whatever its tag, so this test could not narrow a static away.
 *
 * @param {unknown} node
 * @returns {node is readonly [StaticId]}
 */
export const isStatic = node => node instanceof Array && node.length === 1 && staticIds.some(id => id === node[0])

/**
 * A static function's path, the keys of its tag — `['Number', 'isInteger']`
 * for `Number.isInteger` — as [`../js/static`](../js/static/module.f.js)
 * admits it; the runtime is asked by the tag itself.
 *
 * @type {(id: StaticId) => readonly string[]}
 */
export const staticPath = id => id.split('.')

/**
 * The text of a built-in named `name`, NativeFunction syntax
 * ([`Function.prototype.toString`](https://tc39.es/ecma262/#sec-function.prototype.tostring)):
 * `function is() { [native code] }`. A static function's is
 * {@link staticText}; the runtime as a value gives it to every function
 * its `static` and `member` sections reach (`fjs/compiler/rust/runtime`).
 *
 * @type {(name: string) => string}
 */
export const nativeFunctionText = name => `function ${name}() { [native code] }`

/**
 * A static function's text, `String(Object.is)`: what ECMA-262 requires
 * of a built-in function
 * ([`Function.prototype.toString`](https://tc39.es/ecma262/#sec-function.prototype.tostring)),
 * NativeFunction syntax naming its [[InitialName]] — the last key of its
 * path, `is` — with no parameters, as most engines print it. A runtime
 * function is the built-in, not its body, so every executor answers this
 * text and never the body's: the represented ones from here, NaNVM from
 * the built-in's name.
 *
 * @type {(id: StaticId) => string}
 */
export const staticText = id => nativeFunctionText(`${staticPath(id).at(-1)}`)

/**
 * The failure of a static function no binding answers, by its name: the
 * parser admitted it, so the binding is the executor's to supply, and an
 * executor without it fails naming the static, never answering `undefined`
 * or a plausible value.
 *
 * @type {(name: string) => string}
 */
export const noStatic = name => `no binding for the static ${name}`

/**
 * The intrinsics: the member functions no body can define — the
 * primitives of `fjs/js/runtime/README.md`, under the code's word for
 * them, since `Primitive` is the EDAG's name for a literal value — which
 * every executor binds natively, and which a module calls as a function
 * through a helper the parser recognizes whole, `(s, a, b) => s.slice(a, b)`
 * ([`../js/intrinsic`](../js/intrinsic/module.f.js)): each the helper's
 * tag, the member's name, and the helper's `length`, the receiver and the
 * native's arguments. A call of the node, `['()', ['slice'], [s, a, b]]`,
 * is the member call `s.slice(a, b)` as an executor answers it with no
 * runtime — the receiver's own property, else the native, else the
 * `TypeError` of calling `undefined` — which is how the runtime's own
 * bodies reach a native without naming what the runtime defines
 * (`fjs/js/runtime/README.md`, "Two invariants"). As a value the node is fresh where it
 * is established, as `entry` is and every `=>` is.
 */
export const intrinsics = intrinsicDefinitions

/** The intrinsics' tags, {@link intrinsics}: `slice`, `charCodeAt`. */
export const intrinsicIds = intrinsicNames

/** An intrinsic as a value, `['slice']`: one tag of {@link intrinsicIds}. */
export const intrinsicId = intrinsicIdSchema

/**
 * Whether a node — the EDAG's, or the AST's, which shares it — is an
 * intrinsic, `['slice']`: one tag of {@link intrinsicIds} and nothing
 * else, asked as {@link isStatic} is, before a `switch` on the tag.
 *
 * @param {unknown} node
 * @returns {node is readonly [IntrinsicId]}
 */
export const isIntrinsic = node => node instanceof Array && node.length === 1 && intrinsicIds.some(id => id === node[0])

/**
 * The helpers: the function nodes that are not lambdas — `entry` and
 * `hasEntry`, the language's two entry helpers (see {@link op0Id}), and the
 * {@link intrinsics} — each with its `length`. Every question about the
 * whole set (is this a helper, what is its arity, what is its text) asks
 * this one table instead of listing the tags again.
 */
export const helpers = /** @type {const} */ ([['entry', 2], ['hasEntry', 2], ...intrinsics])

/** The helpers' tags, {@link helpers}: `entry`, `hasEntry` and the intrinsics'. */
export const helperIds = helpers.map(([id]) => id)

/**
 * Whether a node — the EDAG's, or the AST's, which shares it — is a
 * helper, `['entry']` or `['slice']`: one tag of {@link helperIds} and
 * nothing else, asked as {@link isIntrinsic} is.
 *
 * @param {unknown} node
 * @returns {node is readonly [HelperId]}
 */
export const isHelper = node => node instanceof Array && node.length === 1 && helperIds.some(id => id === node[0])

/**
 * The `length` of a helper, {@link helpers}: `2` for `entry` and
 * `hasEntry`, the receiver and the key; `3` for `slice`, the receiver and
 * the native's two positions; `2` for `charCodeAt`, the receiver and the
 * position.
 *
 * @type {(id: HelperId) => number}
 */
export const helperLength = id => helpers.filter(([i]) => i === id)[0][1]

/**
 * Whether a node is a function node: an EDAG lambda, `'=>'`, or a
 * {@link isHelper | helper}. A static function, `['Object.is']`, is not
 * one; a site that also admits it asks {@link isStatic} beside this.
 *
 * @type {(node: unknown) => boolean}
 */
export const isFunctionNode = node => node instanceof Array && (node[0] === '=>' || isHelper(node))


/**
 * `op0`/`op1`/`op2` group operation nodes by their `exp`-operand count —
 * zero, one, or two. `undefined`, module imports (`args`), invocation
 * rest (`rest`), the owning function itself (`self`), the `entry`
 * helper (`entry`), the intrinsics ({@link intrinsicId}) and the static
 * functions ({@link staticId}) have no expression operands. `self` is the function whose body holds it, as a value — the
 * same value every read, so recursion is `['()', ['self'], args]` and a
 * nested function captures its parent's `self` as a slot — and it is what
 * keeps a recursive function an acyclic graph: without it a function would
 * have to hold itself. It reaches the innermost function alone; two
 * functions calling each other are `todo/edag-stage1-discussion.md`'s
 * open subject. Functions, fixed reads and
 * frame slot reads have separate tuples because their metadata is not an
 * expression operand.
 *
 * `entry` is the language's `entry` helper
 * (`../../spec/README.md`, "Reading an entry at run time"), as a value:
 *
 * ```js
 * (a, b) => {
 *     const x = Object.getOwnPropertyDescriptor(a, b);
 *     return x?.enumerable ? x.value : undefined;
 * }
 * ```
 *
 * A function of `length` `2` capturing nothing, minting a fresh identity
 * where it is established as every `=>` does, and called as any function
 * is, `['()', ['entry'], [a, b]]`: the value of the enumerable own
 * property the key names — an object's field, an array's or a string's
 * element — and `undefined` for none, an entry holding `undefined`
 * included, and for nothing a value owns without enumerating it, a
 * `length` or anything of a function — the key converted as
 * `Object.getOwnPropertyDescriptor` converts it, `0` and `"0"` naming one
 * entry, once a `null` or `undefined` receiver has failed (`entryJs` in
 * `./proof.f.mjs`). The compiler emits the node
 * for the helper written in source, and the writer spells it back as the
 * helper and no other way: the source has no other spelling of a key
 * computed at run time.
 *
 * `hasEntry` is the helper beside it, the presence as a boolean, `true`
 * for an entry holding `undefined`: `['()', ['hasEntry'], [a, b]]`
 * ([spec: why two helpers](../../spec/property-access/entries/README.md#why-two-helpers)).
 *
 * The intrinsics, {@link intrinsicId}, are the helpers calling a member
 * function no body defines, `['slice']`.
 *
 * The rest are the static functions, {@link staticId}.
 */
export const op0Id = op0IdSchema


/** @type {readonly [typeof op0Id]} */
export const op0 = schemas.op0

// Unary Operations

/**
 * `String`/`Number`/`BigInt`/`Boolean` are conversion operators, `!` is logical and `~` bitwise not, and
 * `typeof` is the type tag of its operand — always a fresh string, never the
 * operand itself, so it is the one unary operation with no identity concern.
 * `typeof` is pure, so the EDAG admits it, as it admits unary `+` (see
 * `op12Id` below); which operations the language spells as syntax —
 * `typeof`, not unary `+` — is decided in `../../spec/operators/README.md`,
 * not here. Negation is not here
 * either: it is `-` at unary arity, an `op12`.
 * `Boolean` applies the common runtime's `Boolean` body to its operand;
 * the reference body is double logical negation, `value => !!value`.
 *
 * `throw` is the one operation that never has a value: it establishes its
 * operand and fails, with that value as the failure's — the language's
 * `throw` statement, `../../spec/README.md`'s "Failure is one outcome". It
 * has no result to mint identity for, so the analysis merges two spelled
 * alike as it merges any operator, and its laziness is positional as every
 * node's is: in an arm of `?:` it fails only where the arm is selected,
 * and an executor never establishes it where the program would not.
 */
export const op1Id = op1IdSchema

/** @type {readonly [typeof op1Id, typeof exp]} */
export const op1 = schemas.op1

// Binary Operations

/**
 * Eager comparison, arithmetic and bitwise operators. Source logical operators
 * are normalized to conditionals before graph construction. `+` and `-` also
 * have unary arities and belong to op12; static functions remain values.
 */
export const op2Id = op2IdSchema

/** @type {readonly [typeof op2Id, typeof exp, typeof exp]} */
export const op2 = schemas.op2

// Operations at both arities

/**
 * The two tags legal at both arities, spelled as JS spells them: `['-', a]`
 * is negation and `['-', a, b]` subtraction, `['+', a]` is unary plus and
 * `['+', a, b]` addition. The node's length decides which, and closedness by
 * length is what makes that safe — each arm is an exact tuple, so a
 * one-operand value matches only the unary arm and a two-operand value only
 * the binary one, the same way a chain step ends at its shorter arity. An
 * earlier draft spelled negation `neg` because tuples were open then and
 * `['-', a]` would also have matched `['-', a, b]`; that reason is gone.
 *
 * The three operation vocabularies stay pairwise disjoint: no tag here is in
 * `op1Id` or `op2Id`. A consumer that fixes an operand count from the
 * vocabulary alone can still do so for those two, and knows this is the one
 * vocabulary where the node decides.
 *
 * Unary `+` is JS unary plus — `ToNumber` on its operand — and so **throws
 * on a bigint** where `Number` converts. The two are different operations,
 * not two spellings of one. `Number` is FunctionalScript's coercion form and
 * unary `+` is not FunctionalScript syntax at all
 * (`../../spec/operators/README.md`): the EDAG spells it because it is a
 * pure operation an executor can implement, and which of the EDAG's
 * operations the language admits as syntax is the language's decision, not
 * the schema's.
 */
export const op12Id = op12IdSchema

/** @type {() => readonly ['or',
 *  readonly [typeof op12Id, typeof exp],
 *  readonly [typeof op12Id, typeof exp, typeof exp]]} */
export const op12 = schemas.op12

// Ternary Operations

/**
 * `?:` is the conditional: `['?:', c, t, e]` establishes `c`, then exactly
 * one of `t` and `e` — the one `ToBoolean(c)` selects — and is that arm's
 * value. Laziness is positional: the unselected
 * arm is not established *here*, and the same node reached from an eager
 * position elsewhere still is. It is subject 3 of
 * `../../todo/edag-stage1-discussion.md`, "Lazy operators and the branch
 * extension path", implemented — as a vocabulary of its own, since `op1` and
 * `op2` each fix one operand count and `op12` fixes two.
 */
export const op3Id = op3IdSchema

/** @type {readonly [typeof op3Id, typeof exp, typeof exp, typeof exp]} */
export const op3 = schemas.op3

// Instance Check

/**
 * The constructors `instanceof` may name: a closed list, `Array` alone
 * today, where `instanceof Map` and `instanceof Set` are one name each
 * once the language can build a `Map` or a `Set` for the test to be true
 * of. `Object` and `Function` are not here and never will be:
 * `typeof x === "object"` and `typeof x === "function"` are the language's
 * spellings for those (`../../spec/README.md`, Operators).
 */
export const constructorId = constructorIdSchema

/**
 * `['instanceof', x, c]` is `x instanceof c` for a built-in constructor
 * `c`: `true` when `x` is an instance — an array, for `Array` — and
 * `false` of every other value, `null` and `undefined` included; it never
 * throws and converts nothing. The constructor is a *name*, not an
 * operand: no global is a value in the EDAG, so the right side of the
 * language's `instanceof` is carried as the word it is, the way `arg` and
 * `frame` carry an index. Every reader that walks operands generically
 * therefore needs an arm for this node — a string is otherwise a valid
 * expression, and the name would be walked as a literal.
 */
/** @type {readonly ['instanceof', typeof exp, typeof constructorId]} */
export const instanceOf = schemas.instanceOf

// Entry Check

/**
 * `['in', key, x]` is the language's `"key" in x`: whether `x`, an object,
 * an array or a function, owns an enumerable entry under `key`, one
 * holding `undefined` included, and a throw for `null`, `undefined` and
 * every primitive, the `TypeError` JavaScript's `in` throws. The key is a
 * *spelling*, not an operand: a string literal the compiler admitted, one
 * that names no property a built-in prototype gives a value, `length`
 * aside, so that the own-property answer is JavaScript's; it is never evaluated, as
 * `instanceof`'s constructor name is not, and a reader walking operands
 * generically needs an arm for it, since a string is otherwise a literal
 * operand. The answer is the runtime's body, `runtime.in(key, x)`, which
 * an executor calls or substitutes natively
 * (`../../spec/todo/2346-in-operator.md`).
 */
/** @type {readonly ['in', typeof string, typeof exp]} */
export const inOp = schemas.inOp

// Traversal

/**
 * Whether an item of a list, {@link items}, is a spread rather than a
 * plain operand.
 *
 * @template E
 * @param {E | readonly ['...', E]} item
 * @returns {item is readonly ['...', E]}
 */
const isSpread = item => item instanceof Array && item[0] === '...'

/**
 * An item list with `f` applied to every operand, a spread kept a spread
 * around its operand's image: the map over an array's items or a call's
 * arguments, whatever the operands are. A walk that threads a state through
 * the items, as an executor's evaluation does, or spells a spread as text,
 * as a writer does, is not a map and keeps its own loop.
 *
 * @type {<E, F>(f: (e: E) => F) => (items: ItemsOver<E>) => ItemsOver<F>}
 */
export const mapItems = f => items => items.map(item => isSpread(item) ? ['...', f(item[1])] : f(item))

/**
 * What a chain's steps hold, in written order: each `|.` step's key read
 * by `key` and each call step's item list by `args`, then its
 * continuation's, and nothing where there is no step. The fold under every
 * walk that lists a chain's operands.
 *
 * @type {<E, I, O>(key: (i: I) => readonly O[], args: (items: ItemsOver<E>) => readonly O[]) => (k: StepOver<E, I> | undefined) => readonly O[]}
 */
export const stepOperands = (key, args) => k => {
    if (k === undefined) { return [] }
    const [, , next] = k
    return [...(k[0] === '|.' ? key(k[1]) : args(k[1])), ...stepOperands(key, args)(next)]
}

/**
 * A chain's steps with each `|.` step's key mapped by `key` and each call
 * step's item list by `items`, every tag and arity kept: the map twin of
 * {@link stepOperands}.
 *
 * @type {<E, I, F, J>(key: (i: I) => J, items: (items: ItemsOver<E>) => ItemsOver<F>) => (k: StepOver<E, I>) => StepOver<F, J>}
 */
export const mapSteps = (key, items) => k => {
    const [, , next] = k
    const rest = next === undefined ? [] : [mapSteps(key, items)(next)]
    return /** @type {StepOver<any, any>} */ (/** @type {unknown} */ (k[0] === '|.' ? ['|.', key(k[1]), ...rest] : [k[0], items(k[1]), ...rest]))
}
