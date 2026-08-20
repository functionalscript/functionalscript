/**
 * @import { Assert } from '../asserts/types.ts'
 * @import {
 *  Check,
 *  Args,
 *  Array,
 *  Call,
 *  Exp,
 *  Primitive,
 *  Property,
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
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
 * `args`, `propertyAccessor`, `call`, and `propertyCall` are rtti tuple
 * schemas, and tuple schemas are intentionally *open* — see "Structs and
 * tuples are open" in `../types/rtti/README.md`. `validate`/`parse` only
 * visit the positions a schema declares, so a value with a trailing extra —
 * `['args', 'ignored']`, `['.', 'a', 'b', 'extra']` — validates today:
 * `validate` accepts it and leaves it in place, `parse` drops it on the way
 * out. `array` and `object` are open the same way, on their element/entry
 * list rather than the tag.
 *
 * Exact arity for these fixed-shape nodes will matter once EDAG values are
 * content-addressed — two byte sequences for "the same" node must not both
 * validate — but that is future work behind the planned `close` schema form
 * (`../types/rtti/todo/close-type.md`), not implemented here yet.
 */

// Exp

export const exp = () => /** @type {const} */(['or',
    primitive,
    array,
    object,
    args,
    propertyAccessor,
    call,
    propertyCall,
])

/** @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert */

// Primitive

export const primitive = or(undefined, null, boolean, number, string, bigint)

/** @typedef {Assert<Check<Primitive, typeof primitive>>} _Primitive */

// Array

export const array = /** @type {const} */(['[]', rttiArray(exp)])

/** @typedef {Assert<Check<Array, typeof array>>} _Array */

// Property

export const property = /** @type {const} */([exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Object

export const object = /** @type {const} */(['{}', rttiArray(property)])

/** @typedef {Assert<Check<Object, typeof object>>} _Object */

// Args

export const args = /** @type {const} */(['args'])

/** @typedef {Assert<Check<Args, typeof args>>} _Args */

// Property Accessor

const _propertyAccessor = /** @type {const} */(['.', exp, exp])

/**
 * ```js
 * exp0[exp1]
 * exp0.exp1
 * ```
 *
 * @type {Phantom<typeof _propertyAccessor, PropertyAccessor>}
 */
export const propertyAccessor = _propertyAccessor

/** @typedef {Assert<Check<PropertyAccessor, typeof _propertyAccessor>>} _PropertyAccessor0 */
/** @typedef {Assert<Check<PropertyAccessor, typeof propertyAccessor>>} _PropertyAccessor1 */

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

/** @typedef {Assert<Check<Call, typeof _call>>} _Call0 */
/** @typedef {Assert<Check<Call, typeof call>>} _Call1 */

// Property Call

const _propertyCall = /** @type {const} */(['.()', exp, exp, exp])

/**
 * ```js
 * exp0[exp1](exp2)
 * ```
 *
 * @type {Phantom<typeof _propertyCall, PropertyCall>}
 */
export const propertyCall = _propertyCall

/** @typedef {Assert<Check<PropertyCall, typeof _propertyCall>>} _PropertyCall0 */
/** @typedef {Assert<Check<PropertyCall, typeof propertyCall>>} _PropertyCall1 */
