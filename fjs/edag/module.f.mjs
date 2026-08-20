/**
 * @module
 *
 * @import { Assert } from '../asserts/types.ts'
 * @import {
 *  Check,
 *  Args,
 *  Array,
 *  Call,
 *  Exp,
 *  Primitive,
 *  Property,
 *  NumberCast,
 *  StringCast,
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
 *  UndefinedOp,
 *  Add,
 *  Sub,
 *  Neg,
 *  Own,
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
 * `args`, `propertyAccessor`, `call`, and `propertyCall` (like `array`/`object`)
 * are open on trailing/extra elements — see "Structs and tuples are open" in
 * `../types/rtti/README.md`. Exact arity is tracked as future work in
 * `../types/rtti/todo/close-type.md`, not implemented here yet.
 *
 * Do not call `parse(exp)` or rely on `validate(exp)` rejecting cycles
 * without reading `../types/rtti/todo/identity-aware-parse.md` first —
 * neither is identity-aware, and that TODO covers why and what's missing.
 */

// Exp

/**
 * @type {() => readonly['or',
 *  typeof primitive,
 *  typeof array,
 *  typeof object,
 *  typeof args,
 *  typeof numberCast,
 *  typeof stringCast,
 *  typeof propertyAccessor,
 *  typeof call,
 *  typeof propertyCall,
 *  typeof own,
 *  typeof add,
 *  typeof sub,
 *  typeof neg,
 * ]}
 */
export const exp = () => (['or',
    primitive,
    array,
    object,
    args,
    numberCast,
    stringCast,
    propertyAccessor,
    call,
    propertyCall,
    own,
    add,
    sub,
    // `neg` must be tried after `sub`: both are tagged `"-"`, and a tuple's
    // trailing positions are open (see the module doc comment above), so
    // `neg`'s one-operand schema would also match `['-', a, b]` — silently
    // dropping `b` — if it were checked first. `or` returns the first match
    // (`../types/rtti/common/module.f.mjs`'s `orVisit`), so this order is
    // load-bearing, not cosmetic.
    neg,
])

/** @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert */

// Undefined

export const undefinedOp = /** @type {const} */(['undefined'])

/** @typedef {Assert<Check<UndefinedOp, typeof undefinedOp>>} _UndefinedOp */

// Primitive

export const primitive = or(undefinedOp, null, boolean, number, string, bigint)

/** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */

// Array

/**
 * ```js
 * [exp0, exp1]
 * ```
 */
export const array = /** @type {const} */(['[]', rttiArray(exp)])

/** @typedef {Assert<Check<Array, typeof array>>} _Array */

// Property

/**
 * The key stays `exp`, not narrowed to a string constant — see
 * `../../todo/edag-stage1-discussion.md` subject 4.
 */
export const property = /** @type {const} */([':', exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Object — same nesting as `array` above, one position further in

/**
 * ```js
 * {
 *     a: exp0,
 *     "a": exp1,
 *     [exp2]: exp3,
 * }
 * ```
 */
export const object = /** @type {const} */(['{}', rttiArray(property)])

/** @typedef {Assert<Check<Object, typeof object>>} _Object */

// Args

/**
 * A function arguments.
 */
export const args = /** @type {const} */(['args'])

/** @typedef {Assert<Check<Args, typeof args>>} _Args */

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
 * @typedef {Assert<Check<NumberCast, typeof _numberCast>>} _NumberCast0
 * @typedef {Assert<Check<NumberCast, typeof numberCast>>} _NumberCast1
 */

// String

const _stringCast = /** @type {const} */(['String', exp])

/**
 * ```js
 * String(exp)
 * ```
 *
 * @type {Phantom<typeof _stringCast, StringCast>}
 */
export const stringCast = _stringCast

/**
 * @typedef {Assert<Check<StringCast, typeof _stringCast>>} _StringCast0
 * @typedef {Assert<Check<StringCast, typeof stringCast>>} _StringCast1
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
 * @typedef {Assert<Check<PropertyAccessor, typeof _propertyAccessor>>} _PropertyAccessor0
 * @typedef {Assert<Check<PropertyAccessor, typeof propertyAccessor>>} _PropertyAccessor1
 */

// Call

const _call = /** @type {const} */(['()', exp, exp])

/**
 * ```js
 * exp0(exp1)
 * ```
 *
 * @type {Phantom<typeof _call, Call>}
 */
export const call = _call

/**
 * @typedef {Assert<Check<Call, typeof _call>>} _Call0
 * @typedef {Assert<Check<Call, typeof call>>} _Call1
 */

// Property Call

const _propertyCall = /** @type {const} */(['.()', exp, index, exp])

/**
 * ```js
 * exp0[exp1](exp2)
 * ```
 *
 * @type {Phantom<typeof _propertyCall, PropertyCall>}
 */
export const propertyCall = _propertyCall

/**
 * @typedef {Assert<Check<PropertyCall, typeof _propertyCall>>} _PropertyCall0
 * @typedef {Assert<Check<PropertyCall, typeof propertyCall>>} _PropertyCall1
 */

// own, `const own = (a, b) => Object.getOwnPropertyDescriptor(a, k)?.value`

const _own = /** @type {const} */(['own', exp, exp])

/** @type {Phantom<typeof _own, Own>} */
export const own = _own

/**
 * @typedef {Assert<Check<Own, typeof _own>>} _Own0
 * @typedef {Assert<Check<Own, typeof own>>} _Own1
 */

// Binary +

const _add = /** @type {const} */(['+', exp, exp])

/** @type {Phantom<typeof _add, Add>} */
export const add = _add

/**
 * @typedef {Assert<Check<Add, typeof _add>>} _Add0
 * @typedef {Assert<Check<Add, typeof add>>} _Add1
 */

// Binary -

const _sub = /** @type {const} */(['-', exp, exp])

/** @type {Phantom<typeof _sub, Sub>} */
export const sub = _sub

/**
 * @typedef {Assert<Check<Sub, typeof _sub>>} _Minus0
 * @typedef {Assert<Check<Sub, typeof sub>>} _Minus1
 */

// Negation (aka a unary minus) — tagged `"-"`, same as `sub`; arity
// distinguishes them (see the ordering note on `exp` above)

const _neg = /** @type {const} */(['-', exp])

/** @type {Phantom<typeof _neg, Neg>} */
export const neg = _neg

/**
 * @typedef {Assert<Check<Neg, typeof _neg>>} _Neg0
 * @typedef {Assert<Check<Neg, typeof neg>>} _Neg1
 */
