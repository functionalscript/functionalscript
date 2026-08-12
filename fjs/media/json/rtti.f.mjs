/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Ts } from '../../types/rtti/ts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Unknown } from './types.ts'
 */

import { boolean, number, or, record, string, array as rttiArray } from '../../types/rtti/module.f.mjs'

/** rtti schema matching any JSON primitive: `null`, `boolean`, `number`, or `string`. */
export const primitive = or(null, boolean, number, string)

/**
 * rtti schema matching any JSON value: a primitive, an array of JSON values,
 * or an object whose values are JSON values. Self-referential via a thunk;
 * rtti instantiates array/record item validators lazily so recursion terminates
 * on acyclic input.
 *
 * A struct field typed `unknown` is **required when present** — unlike rtti
 * core's `unknown`, the JSON `unknown` excludes `undefined`.
 */
export const unknown = () => /** @type {const} */(['or', primitive, object, array])

/**
 * rtti schema matching a JSON object: `{ readonly [k: string]?: Unknown }`.
 */
export const object = record(unknown)

/** rtti schema matching a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)

/** @typedef {Assert<Equal<Unknown, Ts<typeof unknown>>>} _Unknown */
