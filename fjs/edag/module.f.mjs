/**
 * @module
 *
 * @import { Assert } from '../asserts/types.ts'
 * @import { Check, Check3 } from '../types/rtti/ts/types.ts'
 * @import {
 *  Args,
 *  Array,
 *  Exp,
 *  Primitive,
 *  Property,
 *  NumberCast,
 *  StringCast,
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
 *  UndefinedOp,
 *  Neg,
 *  Comma,
 *  Frame,
 *  BinaryOpId,
 *  BinaryOp,
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
 *  typeof propertyCall,
 *  typeof neg,
 *  typeof comma,
 *  typeof frame,
 *  typeof binaryOp,
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
    propertyCall,
    neg,
    comma,
    frame,
    binaryOp,
])

/** @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert */

// Undefined

export const undefinedOp = /** @type {const} */(['undefined'])

/** @typedef {Assert<Check<UndefinedOp, typeof undefinedOp>>} _UndefinedOp */

// Primitive

export const primitive = or(undefinedOp, null, boolean, number, string, bigint)

/** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */

const exps = rttiArray(exp)

// Array

/**
 * ```js
 * [exp0, exp1]
 * ```
 */
export const array = /** @type {const} */(['[]', exps])

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
 * @typedef {Assert<Check3<NumberCast, typeof _numberCast, typeof numberCast>>} _NumberCast
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
 * @typedef {Assert<Check3<StringCast, typeof _stringCast, typeof stringCast>>} _StringCast
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
 * exp0[exp1](exp2)
 * ```
 *
 * @type {Phantom<typeof _propertyCall, PropertyCall>}
 */
export const propertyCall = _propertyCall

/**
 * @typedef {Assert<Check3<PropertyCall, typeof _propertyCall, typeof propertyCall>>} _PropertyCall
 */

// Negation (aka a unary minus) — a word tag, `"neg"`, not `"-"`'s unary
// arity (an earlier draft overloaded `"-"` the way JS itself does; see
// `../../todo/edag-stage1-discussion.md`'s "Operators" section for why that
// was dropped). `sub` and `neg` therefore don't share a tag, so — unlike a
// shared-tag pair would — neither's position in `exp`'s `or` list matters
// relative to the other.

const _neg = /** @type {const} */(['neg', exp])

/** @type {Phantom<typeof _neg, Neg>} */
export const neg = _neg

/**
 * @typedef {Assert<Check3<Neg, typeof _neg, typeof neg>>} _Neg
 */

// Comma

const _comma = /** @type {const} */([',', exps])

/** @type {Phantom<typeof _comma, Comma>} */
export const comma = _comma

/**
 * @typedef {Assert<Check3<Comma, typeof _comma, typeof comma>>} _Comma
 */

// Frame

export const frame = /** @type {const} */(['frame'])

/** @typedef {Assert<Check<Frame, typeof frame>>} _Frame */

// Unary Operations

export const unaryOpId = or('neg')

// Binary Operations

export const binaryOpId = or(
    '=>', 'own', '()',
    '===', '!==', '>', '>=', '<', '<=',
    '+', '-', '*', '/', '%', '**',
    '&', '|', '^', '<<', '>>', '>>>',
    '&&', '||', '??'
)

/** @typedef {Assert<Check<BinaryOpId, typeof binaryOpId>>} _BinaryOpId */

const _binaryOp = /** @type {const} */([binaryOpId, exp, exp])

/** @type {Phantom<typeof _binaryOp, BinaryOp>} */
export const binaryOp = _binaryOp

/** @typedef {Assert<Check3<BinaryOp, typeof _binaryOp, typeof binaryOp>>} _BinaryOp */
