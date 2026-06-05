/**
 * rtti schemas for JSON values — the JSON counterpart of rtti's `unknown`.
 *
 * These schemas describe the `fs/json` value domain: `null`, `boolean`,
 * `number`, `string`, arrays, and objects — no `bigint` or `undefined`.
 * A struct field typed with {@link unknown} is **required when present**
 * (unlike rtti core's `unknown`, which admits `undefined` and so makes any
 * field that uses it implicitly optional).
 *
 * Kept in `fs/json/rtti` rather than `fs/types/rtti` so that rtti core
 * remains value-system-agnostic.
 *
 * @module
 */
import { boolean, number, or, string, record, array as rttiArray } from '../../types/rtti/module.f.ts'

/** Matches any JSON primitive: `null`, `boolean`, `number`, or `string`. */
export const primitive = or(null, boolean, number, string)

/**
 * Matches any JSON value: a primitive, an array of JSON values, or an object
 * whose values are JSON values. Self-referential via a thunk; rtti instantiates
 * array/record item validators lazily so recursion terminates on acyclic input.
 */
export const unknown = () => ['or', primitive, object, array] as const

/** Matches a JSON object: `{ readonly [k: string]: Unknown }`. */
export const object = record(unknown)

/** Matches a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)
