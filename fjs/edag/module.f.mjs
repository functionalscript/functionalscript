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
 *  PropertyAccessor,
 *  Object,
 *  PropertyCall,
 * } from './types.ts'
 * @import { Phantom } from '../types/phantom/types.ts'
 */

import {
    bigint,
    boolean,
    number as number,
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

/**
 * `['[]', ...elements]` and `['{}', ...properties]` — the flat, variadic
 * spelling the EDAG spec uses — cannot be written as an rtti schema. A `Tuple`
 * (see `Const` in `../types/rtti/types.ts`) declares one schema per position,
 * so it can pin a fixed prefix like the `'[]'`/`'{}'` tag, but the `Type` ADT
 * has no variant for "then any number of further positions, all matching
 * this one schema" — `array`/`record` say exactly that, but only as their
 * *own* single schema position, not spread inline into a bigger tuple's
 * remaining slots. So `array` and `object` below nest the variadic part in
 * that second position instead: `['[]', [elem, elem, ...]]` and
 * `['{}', [prop, prop, ...]]` — one array/record position holding the whole
 * tail, rather than a tail of positions.
 */

// Array

export const array = /** @type {const} */(['[]', rttiArray(exp)])

/** @typedef {Assert<Check<Array, typeof array>>} _Array */

// Property

export const property = /** @type {const} */([':', exp, exp])

/** @typedef {Assert<Check<Property, typeof property>>} _Property */

// Object — same nesting as `array` above, one position further in

export const object = /** @type {const} */(['{}', rttiArray(property)])

/** @typedef {Assert<Check<Object, typeof object>>} _Object */

// Args

export const args = /** @type {const} */(['args'])

/** @typedef {Assert<Check<Args, typeof args>>} _Args */

// Number

export const numberCast = /** @type {const} */(['Number', exp])

/** @typedef {Assert<Check<NumberCast, typeof numberCast>>} _NumberCast */

// Type

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

const _propertyCall = /** @type {const} */(['.()', exp, index, exp])

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
