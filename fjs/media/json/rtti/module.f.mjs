/**
 * rtti schemas describing the JSON data model: `primitive`, `unknown`,
 * `object`, and `array`.
 *
 * The three composite schemas are mutually recursive — `unknown` names
 * `object` and `array`, both of which are built from `unknown` — so `unknown`
 * carries an explicit `@type` that cross-references its neighbours through
 * `typeof`. That spelling is deliberate: `@type {const}` also type-checks here,
 * but leaves declaration emit no name for the recursive positions, so it
 * inlines the structure, gives up at depth, and degrades the emitted `.d.mts`
 * to `any`. See `fjs/AGENTS.md` §3.2.
 *
 * The TypeScript counterparts live in the sibling
 * [`../types.ts`](../types.ts), which pins them against these schemas with
 * `Assert<Check<Unknown, typeof unknown>>`.
 *
 * @module
 */

import {
    boolean as rttiBoolean,
    number as rttiNumber,
    string as rttiString,
    or,
    record,
    array as rttiArray
} from '../../../rtti/module.f.mjs'

/** rtti schema matching any JSON primitive: `null`, `boolean`, `number`, or `string`. */
export const primitive = or(null, rttiBoolean, rttiNumber, rttiString)

/**
 * rtti schema matching any JSON value: a primitive, an array of JSON values,
 * or an object whose values are JSON values. Self-referential via a thunk;
 * rtti instantiates array/record item validators lazily so recursion terminates
 * on acyclic input.
 *
 * A struct field typed `unknown` is **required when present** — unlike rtti
 * core's `unknown`, the JSON `unknown` excludes `undefined`.
 *
 * @type {() => readonly['or', typeof primitive, typeof object, typeof array]}
 */
export const unknown = () => ['or', primitive, object, array]

/**
 * rtti schema matching a JSON object: `{ readonly [k: string]?: Unknown }`.
 */
export const object = record(unknown)

/** rtti schema matching a JSON array: `readonly Unknown[]`. */
export const array = rttiArray(unknown)
