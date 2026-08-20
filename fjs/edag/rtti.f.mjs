/**
 * @import { Ts } from '../types/rtti/ts/types.ts'
 * @import { Assert } from '../asserts/types.ts'
 * @import { Equal } from '../types/ts/types.ts'
 * @import { Exp, Primitive, PropertyAccessor } from './types.ts'
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

/** @type {() => ['or', typeof primitive, typeof array, typeof object, typeof args]} */
export const exp = () => (['or',
    primitive,
    array,
    object,
    args,
    // propertyAccessor,
])

/** @typedef {Assert<Equal<Exp, Ts<typeof exp>>>} _0 */

export const primitive = or(undefined, null, boolean, number, string, bigint)

/** @typedef {Assert<Equal<Primitive, Ts<typeof primitive>>>} _1 */

export const array = /** @type {const} */(['[]', rttiArray(exp)])

export const property = /** @type {const} */([exp, exp])

export const object = /** @type {const} */(['{}', rttiArray(property)])

export const args = /** @type {const} */(['args'])

export const propertyAccessor = /** @type {const} */(['.', exp, exp])

/** @typedef {Assert<Equal<PropertyAccessor, Ts<typeof propertyAccessor>>>} _2 */
