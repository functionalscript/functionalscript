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
 *  PropertyCall,
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
 * `propertyAccessor`, `propertyCall`, and `op0`/`op1`/`op2` (like
 * `array`/`object`) are open on trailing/extra elements — see "Structs and
 * tuples are open" in `../types/rtti/README.md`. Exact arity is tracked as
 * future work in `../types/rtti/todo/close-type.md`, not implemented here yet.
 *
 * Do not call `parse(exp)` or rely on `validate(exp)` rejecting cycles
 * without reading `../types/rtti/todo/identity-aware-parse.md` first —
 * neither is identity-aware, and that TODO covers why and what's missing.
 */

// Exp

/**
 * This return type has to be written out explicitly, not left to
 * `@type {const}`: `_exp`'s return recurses through `array`/`object`/`op0`
 * and the rest below, each of which refers back to `exp` — a cycle only a
 * named, forward-referencing signature like this one can close. `@type
 * {const}` can't apply to the arrow function itself (a const assertion only
 * accepts literal expressions, not function expressions — TS1355), and
 * putting it on just the returned array literal instead still leaves the
 * enclosing recursive return type to be inferred, which TypeScript can't do
 * through the cycle: declaration emit falls back to an elided `any` at the
 * recursive edge (e.g. `array`'s second element becomes
 * `readonly ["[]", any]`) instead of the real recursive type.
 *
 * @type {() => readonly['or',
 *  typeof primitive,
 *  typeof array,
 *  typeof object,
 *  typeof propertyAccessor,
 *  typeof propertyCall,
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
    propertyCall,
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

// ...

export const spread = /** @type {const} */(['...', exp])

/** @typedef {Assert<Check<Spread, typeof spread>>} _Spread */

// items

export const items = or(exp, spread)

/** @typedef {Assert<Check<Items, typeof items>>} _Items */

// Array

/**
 * ```js
 * [exp0, exp1]
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
 * The key stays `exp`, not narrowed to a string constant — see
 * `../../todo/edag-stage1-discussion.md` subject 4.
 */
export const property = /** @type {const} */([':', exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Properties

export const properties = or(property, spread)

/** @typedef {Assert<Check<Properties, typeof properties>>} _Properties */

// Object — same nesting as `array` above, one position further in

/**
 * ```js
 * {
 *     a: exp0,
 *     "a": exp1,
 *     [exp2]: exp3,
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

const _numberCast = /** @type {const} */(['Number', exp])

/**
 * ```js
 * Number(exp)
 * ```
 *
 * @type {Phantom<typeof _numberCast, NumberCast>}
 */
export const numberCast = _numberCast

/**
 * @typedef {Assert<Check3<NumberCast, typeof _numberCast, typeof numberCast>>} _NumberCast
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

const _propertyAccessor = /** @type {const} */(['.', exp, index])

/**
 * ```js
 * exp0[exp1]
 * exp0.exp1
 * ```
 *
 * @type {Phantom<typeof _propertyAccessor, PropertyAccessor>}
 */
export const propertyAccessor = _propertyAccessor

/**
 * @typedef {Assert<Check3<PropertyAccessor, typeof _propertyAccessor, typeof propertyAccessor>>} _PropertyAccessor
 */

// Property Call

const _propertyCall = /** @type {const} */(['.()', exp, index, exp])

/**
 * ```js
 * exp0[exp1](...exp2)
 * ```
 *
 * A method call, keeping the `this` binding. The last operand is one node
 * evaluating to the complete argument array, not a literal operand list —
 * the same convention as `()` (see `op2Id`).
 *
 * @type {Phantom<typeof _propertyCall, PropertyCall>}
 */
export const propertyCall = _propertyCall

/**
 * @typedef {Assert<Check3<PropertyCall, typeof _propertyCall, typeof propertyCall>>} _PropertyCall
 */

// Comma

const _comma = /** @type {const} */([',', exps])

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
 *
 * @type {Phantom<typeof _comma, Comma>}
 */
export const comma = _comma

/**
 * @typedef {Assert<Check3<Comma, typeof _comma, typeof comma>>} _Comma
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

const _op0 = /** @type {const} */([op0Id])

/** @type {Phantom<typeof _op0, Op0>} */
export const op0 = _op0

/** @typedef {Assert<Check3<Op0, typeof _op0, typeof op0>>} _Op0 */

// Unary Operations

/**
 * `String`/`Number` are casts, `neg` is arithmetic negation (a word tag —
 * `-` is binary subtraction), `!` is logical and `~` bitwise not.
 */
export const op1Id = or('String', 'Number', 'neg', '!', '~')

/** @typedef {Assert<Check<Op1Id, typeof op1Id>>} _Op1Id */

const _op1 = /** @type {const} */([op1Id, exp])

/** @type {Phantom<typeof _op1, Op1>} */
export const op1 = _op1

/** @typedef {Assert<Check3<Op1, typeof _op1, typeof op1>>} _Op1 */

// Binary Operations

/**
 * `=>` builds a function from a frame and a body: the frame operand is one
 * node evaluated in the enclosing scope, while the body is the inner
 * function's graph — deferred, never established when the closure is built,
 * only on each call, against that function's own `args`/`frame`. `()` calls
 * one — its second operand is one node evaluating to the complete argument
 * array, not a literal operand list: `f(a, b)` is
 * `['()', f, ['[]', [a, b]]]`, spread `f(...xs)` is `['()', f, xs]`. `own`
 * is exactly `Object.getOwnPropertyDescriptor(object, key)?.value` with a
 * computed string key — no key coercion, no getter invocation, no prototype
 * chain (`ownJs` in `./proof.f.mjs`; the Operations table in
 * `../../todo/edag-stage1-discussion.md`). The rest are the JS comparison,
 * arithmetic, bitwise, and logical operators they name — with `&&`/`||`/`??`
 * short-circuiting exactly as in JS: their right operand is conditional,
 * never established eagerly. All this laziness is positional, not nodal —
 * the same node referenced from an eager position elsewhere is still
 * evaluated there.
 */
export const op2Id = or(
    '=>', 'own', '()',
    '===', '!==', '>', '>=', '<', '<=',
    '+', '-', '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??'
)

/** @typedef {Assert<Check<Op2Id, typeof op2Id>>} _Op2Id */

const _op2 = /** @type {const} */([op2Id, exp, exp])

/** @type {Phantom<typeof _op2, Op2>} */
export const op2 = _op2

/** @typedef {Assert<Check3<Op2, typeof _op2, typeof op2>>} _Op2 */
