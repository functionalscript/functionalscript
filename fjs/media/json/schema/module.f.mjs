/**
 * Converts an rtti schema to a JSON Schema (draft 2020-12) object.
 *
 * Driven by `fjs/types/rtti/common/module.f.mjs`'s `visit`, the same shared
 * `Type`-ADT walker used by `validate` and `parse`.
 *
 * @module
 *
 * @import { Struct, Tuple, Type as RttiType } from '../../../types/rtti/types.ts'
 * @import { Visitor } from '../../../types/rtti/common/types.ts'
 * @import { Primitive } from '../../../djs/types.ts'
 * @import { Ts } from '../../../types/rtti/ts/types.ts'
 * @import { Phantom } from '../../../types/phantom/types.ts'
 */

import { array, option, or, record, string } from '../../../types/rtti/module.f.mjs'
import { visit } from '../../../types/rtti/common/module.f.mjs'
import { unknown as jsonUnknown } from '../rtti/module.f.mjs'

const unknownThunk = () => /** @type {const} */ (['const', unknownConst])

/**
 * rtti schema for a JSON Schema (draft 2020-12) document.
 * @type {Phantom<typeof unknownThunk, UnknownConst>}
 */
export const unknown = unknownThunk

/** A JSON Schema (draft 2020-12) document — the subset of keywords that `toJsonSchema` emits. */
/** @typedef {Ts<typeof unknown>} Unknown */

const unknownConst = /** @type {const} */ ({
    type: or('boolean', 'number', 'string', 'integer', 'array', 'object', undefined),
    const: option(jsonUnknown),
    not: option(unknown),
    anyOf: option(array(unknown)),
    items: or(unknown, false, undefined),
    prefixItems: option(array(unknown)),
    properties: option(record(unknown)),
    required: option(array(string)),
    additionalProperties: option(unknown),
})

/**
 * Hand-written base type used as the `$out` annotation on `unknown`.
 *
 * The `?` markers are required even though `Ts<>` already includes `undefined`
 * in each field type. Without `?`, `Unknown = UnknownConst` would require all
 * 9 fields to be present in every object literal returned by `toJsonSchema`,
 * because TypeScript distinguishes "field absent" (`?`) from "field present but
 * undefined" (`T | undefined`). JSON Schema objects only include the fields
 * they need, so all fields must be optional.
 * @typedef {{
 *   readonly type?: Ts<typeof unknownConst.type>
 *   readonly const?: Ts<typeof unknownConst.const>
 *   readonly not?: Ts<typeof unknownConst.not>
 *   readonly anyOf?: Ts<typeof unknownConst.anyOf>
 *   readonly items?: Ts<typeof unknownConst.items>
 *   readonly prefixItems?: Ts<typeof unknownConst.prefixItems>
 *   readonly properties?: Ts<typeof unknownConst.properties>
 *   readonly required?: Ts<typeof unknownConst.required>
 *   readonly additionalProperties?: Ts<typeof unknownConst.additionalProperties>
 * }} UnknownConst
 */

/** Returns true if the rtti schema admits the value `undefined`.
 * @type {(rtti: RttiType) => boolean}
 */
const admitsUndefined = rtti => {
    if (rtti === undefined) { return true }
    if (typeof rtti !== 'function') { return false }
    const [t, ...r] = rtti()
    return t === 'or' ? r.some(admitsUndefined) : false
}

/** Returns the schema with `undefined` removed from any top-level `or`.
 * @type {(rtti: RttiType) => RttiType}
 */
const stripUndefined = rtti => {
    if (typeof rtti !== 'function') { return rtti }
    const [t, ...r] = rtti()
    if (t !== 'or') { return rtti }
    const rest = r.flatMap(t => t !== undefined ? [t] : [])
    return rest.length === 1 ? rest[0] : or(...rest)
}

// Struct: keys not admitting undefined go into `required`; optional keys have
// undefined stripped from their property schema. additionalProperties is omitted
// (lenient), matching rtti's open-struct validation semantics.
/** @type {(rtti: Struct) => Unknown} */
const structSchema = rtti => {
    const ents = Object.entries(rtti)
    const properties = Object.fromEntries(
        ents.map(([k, v]) => [k, toJsonSchema(stripUndefined(v))])
    )
    const required = ents
        .filter(([, v]) => !admitsUndefined(v))
        .map(([k]) => k)
    return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
    }
}

/** @type {(rtti: Primitive) => Unknown} */
const constPrimitiveSchema = rtti =>
    rtti === undefined
        ? { not: {} }
        // bigint consts are represented as numbers (lossy for |value| > MAX_SAFE_INTEGER)
        : { const: typeof rtti === 'bigint' ? Number(rtti) : rtti }

/** @type {Visitor<Unknown>} */
const visitor = {
    tuple: (/** @type {Tuple} */ t) => ({ type: 'array', prefixItems: t.map(toJsonSchema), items: false }),
    struct: structSchema,
    array: item => ({ type: 'array', items: toJsonSchema(item) }),
    record: item => ({ type: 'object', additionalProperties: toJsonSchema(item) }),
    or: variants => ({ anyOf: variants.map(toJsonSchema) }),
    constPrimitive: constPrimitiveSchema,
    // bigint is not representable in JSON Schema; 'integer' is the closest approximation
    primitive0: tag => ({ type: tag === 'bigint' ? 'integer' : tag }),
    unknown: () => ({}),
}

/**
 * Converts an rtti `Type` to a JSON Schema (draft 2020-12) object.
 *
 * | rtti                                          | JSON Schema                                                                         |
 * |-----------------------------------------------|-------------------------------------------------------------------------------------|
 * | `boolean` / `number` / `string`               | `{ "type": "..." }`                                                                 |
 * | `bigint`                                      | `{ "type": "integer" }` (lossy; JSON integers are IEEE-754 doubles)                 |
 * | `unknown`                                     | `{}` (always-true schema)                                                           |
 * | primitive const (`42`, `'x'`, `true`, `null`) | `{ "const": <value> }`                                                              |
 * | `bigint` const                                | `{ "const": Number(value) }` (lossy for \|value\| > MAX_SAFE_INTEGER)               |
 * | `undefined` const                             | `{ "not": {} }` (no JSON value satisfies this)                                      |
 * | struct `{ a: T, … }`                          | `{ "type": "object", "properties": { "a": …T… }, "required": [non-optional keys] }` |
 * | tuple `[A, B]`                                | `{ "type": "array", "prefixItems": […A…, …B…], "items": false }`                    |
 * | `array(T)`                                    | `{ "type": "array", "items": …T… }`                                                 |
 * | `record(T)`                                   | `{ "type": "object", "additionalProperties": …T… }`                                 |
 * | `or(...types)`                                | `{ "anyOf": […each…] }`                                                             |
 *
 * @type {(rtti: RttiType) => Unknown}
 */
export const toJsonSchema = visit(visitor)
