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
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
 *  UndefinedOp,
 *  Comma,
 *  Frame,
 *  BinaryOpId,
 *  BinaryOp,
 *  UnaryOpId,
 *  UnaryOp,
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
 * `args`, `propertyAccessor`, `propertyCall`, and `unaryOp`/`binaryOp` (like
 * `array`/`object`) are open on trailing/extra elements — see "Structs and
 * tuples are open" in `../types/rtti/README.md`. Exact arity is tracked as
 * future work in
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
 *  typeof propertyAccessor,
 *  typeof propertyCall,
 *  typeof comma,
 *  typeof frame,
 *  typeof binaryOp,
 *  typeof unaryOp,
 * ]}
 */
export const exp = () => (['or',
    primitive,
    array,
    object,
    args,
    propertyAccessor,
    propertyCall,
    comma,
    frame,
    binaryOp,
    unaryOp,
])

/** @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert */

// Undefined

/**
 * ```js
 * undefined
 * ```
 *
 * Tagged, unlike the other primitives: a bare `undefined` is
 * indistinguishable from a missing tuple position ("Structs and tuples are
 * open" in `../types/rtti/README.md`), so it gets a node of its own.
 */
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

// Comma

const _comma = /** @type {const} */([',', exps])

/**
 * ```js
 * (exp0, exp1, exp2)
 * ```
 *
 * Establishes all of its operands and takes the value of the last one; the
 * earlier operands exist for their throw-potential only. The shape is a
 * known-incomplete placeholder — it cannot yet say "at least one operand,
 * last is the result"; see the header of `./proof.f.mjs`.
 *
 * @type {Phantom<typeof _comma, Comma>}
 */
export const comma = _comma

/**
 * @typedef {Assert<Check3<Comma, typeof _comma, typeof comma>>} _Comma
 */

// Frame

/**
 * The function's captured-consts frame, the way `args` is for the arguments.
 */
export const frame = /** @type {const} */(['frame'])

/** @typedef {Assert<Check<Frame, typeof frame>>} _Frame */

// Unary Operations

/**
 * `String`/`Number` are casts, `neg` is arithmetic negation (a word tag —
 * `-` is binary subtraction), `!` is logical and `~` bitwise not.
 */
export const unaryOpId = or('String', 'Number', 'neg', '!', '~')

/** @typedef {Assert<Check<UnaryOpId, typeof unaryOpId>>} _UnaryOpId */

const _unaryOp = /** @type {const} */([unaryOpId, exp])

/** @type {Phantom<typeof _unaryOp, UnaryOp>} */
export const unaryOp = _unaryOp

/** @typedef {Assert<Check3<UnaryOp, typeof _unaryOp, typeof unaryOp>>} _UnaryOp */

// Binary Operations

/**
 * `=>` builds a function from a frame and a body, `()` calls one, and `own`
 * reads an own property, bypassing the prototype chain — including
 * `__proto__` (`ownJs` in `./proof.f.mjs`). The rest are the JS comparison,
 * arithmetic, bitwise, and logical operators they name.
 */
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
