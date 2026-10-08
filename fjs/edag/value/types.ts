/**
 * Evaluated EDAG value forms. Shape/schema agreement is checked here;
 * constructors establish closedness, canonical metadata and graph scope;
 * explicit boundaries accepting EDAG data validate those invariants.
 *
 * @module
 */

import type { Exp, Primitive as EdagPrimitive } from '../types.ts'
import type { Assert } from '../../asserts/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Check, Check3 } from '../../rtti/ts/types.ts'
import type { _value, value, values, array, property, object, func, entryFunction } from './module.f.mjs'

/** Evaluated primitives include EDAG's tagged undefined. */
export type Primitive = EdagPrimitive | readonly ['undefined']

export type EdagValue = Primitive | Array | Object | Function

export type Values = readonly EdagValue[]

export type Array = readonly ['[]', Values]

export type Property = readonly [':', string, EdagValue]

export type Object = readonly ['{}', readonly Property[]]

/** A closure: its length, evaluated captures and unevaluated body. */
export type Closure = readonly ['=>', number, Values, Exp]

/** The `entry` helper as a value: a function of `length` `2` the executor calls natively, fresh where the node is established. */
export type EntryFunction = readonly ['entry']

export type Function = Closure | EntryFunction

type _Value = Assert<Check3<EdagValue, typeof _value, typeof value>>
type _Values = Assert<Check<Values, typeof values>>
type _Array = Assert<Check<Array, typeof array>>
type _Property = Assert<Check<Property, typeof property>>
type _Object = Assert<Check<Object, typeof object>>
type _Closure = Assert<Check<Closure, typeof func>>
type _EntryFunction = Assert<Check<EntryFunction, typeof entryFunction>>
type _Subset = Assert<Equal<EdagValue extends Exp ? true : false, true>>
type _ProperSubset = Assert<Equal<Exp extends EdagValue ? true : false, false>>
