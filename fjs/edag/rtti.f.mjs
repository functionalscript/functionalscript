/**
 * @import { Assert } from '../asserts/types.ts'
 * @import {
 *  Check,
 *  Args,
 *  Array,
 *  Exp,
 *  Primitive,
 *  Property,
 *  PropertyAccessor,
 *  Object
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

export const exp = () => /** @type {const} */(['or',
    primitive,
    array,
    object,
    args,
    propertyAccessor,
])

export const primitive = or(undefined, null, boolean, number, string, bigint)

export const array = /** @type {const} */(['[]', rttiArray(exp)])

export const property = /** @type {const} */([exp, exp])

export const object = /** @type {const} */(['{}', rttiArray(property)])

export const args = /** @type {const} */(['args'])

const _propertyAccessor = /** @type {const} */(['.', exp, exp])

/** @type {Phantom<typeof _propertyAccessor, PropertyAccessor>} */
export const propertyAccessor = _propertyAccessor

/**
 * @typedef {Assert<Check<Exp, typeof exp>>} _ExpAssert
 * @typedef {Assert<Check<Primitive, typeof primitive>>} _PrimitiveAssert
 * @typedef {Assert<Check<Array, typeof array>>} _ArrayAssert
 * @typedef {Assert<Check<Property, typeof property>>} _PropertyAssert
 * @typedef {Assert<Check<Object, typeof object>>} _ObjectAssert
 * @typedef {Assert<Check<Args, typeof args>>} _ArgsAssert =
 * @typedef {Assert<Check<PropertyAccessor, typeof propertyAccessor>>} _PropertyAccessor
 */
