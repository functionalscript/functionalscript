
import {
    boolean as rttiBoolean,
    number as rttiNumber,
    string as rttiString,
    or,
    record,
    array as rttiArray
} from '../../types/rtti/module.f.mjs'

/** rtti schema matching any JSON primitive: `null`, `boolean`, `number`, or `string`. */
export const primitive = or(null, rttiBoolean, rttiNumber, rttiString)

/** @typedef {() => ['or', typeof primitive, typeof object, typeof array]} _RttiUnknown */

/**
 * rtti schema matching any JSON value: a primitive, an array of JSON values,
 * or an object whose values are JSON values. Self-referential via a thunk;
 * rtti instantiates array/record item validators lazily so recursion terminates
 * on acyclic input.
 *
 * A struct field typed `unknown` is **required when present** — unlike rtti
 * core's `unknown`, the JSON `unknown` excludes `undefined`.
 *
 * @type {_RttiUnknown}
 */
export const unknown = () => ['or', primitive, object, array]

/**
 * rtti schema matching a JSON object: `{ readonly [k: string]?: Unknown }`.
 */
export const object = record(unknown)

/** rtti schema matching a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)
