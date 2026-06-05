/**
 * Converts an rtti schema to a JSON Schema (draft 2020-12) object.
 *
 * Mirrors the visitor structure of `fs/types/rtti/ts/module.f.ts` (`printer` / `toTs`),
 * but emits a JSON Schema object instead of a TypeScript type string.
 *
 * @module
 */
import type { Const, Type } from '../../types/rtti/module.f.ts'
import { or } from '../../types/rtti/module.f.ts'
import type { Unknown } from '../module.f.ts'

/** Returns true if the rtti schema admits the value `undefined`. */
const admitsUndefined = (rtti: Type): boolean => {
    if (rtti === undefined) { return true }
    if (typeof rtti !== 'function') { return false }
    const [t, ...r] = rtti()
    return t === 'or' ? r.some(admitsUndefined) : false
}

/** Returns the schema with `undefined` removed from any top-level `or`. */
const stripUndefined = (rtti: Type): Type => {
    if (typeof rtti !== 'function') { return rtti }
    const [t, ...r] = rtti()
    if (t !== 'or') { return rtti }
    const rest = r.flatMap(t => t !== undefined ? [t] : [])
    return rest.length === 1 ? rest[0] : or(...rest)
}

const constToJsonSchema = (rtti: Const): Unknown => {
    if (typeof rtti === 'undefined') { return { not: {} } as Unknown }
    if (typeof rtti !== 'object' || rtti === null) {
        // bigint consts are represented as numbers (lossy for |value| > MAX_SAFE_INTEGER)
        return { const: typeof rtti === 'bigint' ? Number(rtti) : rtti } as Unknown
    }
    if (rtti instanceof Array) {
        return {
            type: 'array',
            prefixItems: rtti.map(toJsonSchema),
            items: false,
        } as Unknown
    }
    // Struct: keys not admitting undefined go into `required`; optional keys have
    // undefined stripped from their property schema. additionalProperties is omitted
    // (lenient), matching rtti's open-struct validation semantics.
    const ents = Object.entries(rtti)
    const properties = Object.fromEntries(
        ents.map(([k, v]) => [k, toJsonSchema(stripUndefined(v as Type))])
    )
    const required = ents
        .filter(([, v]) => !admitsUndefined(v as Type))
        .map(([k]) => k)
    return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
    } as Unknown
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
 */
export const toJsonSchema = (rtti: Type): Unknown => {
    if (typeof rtti !== 'function') { return constToJsonSchema(rtti) }
    const [tag, ...rest] = rtti()
    switch (tag) {
        case 'const': return constToJsonSchema(rest[0] as Const)
        case 'boolean': return { type: 'boolean' } as Unknown
        case 'number': return { type: 'number' } as Unknown
        case 'string': return { type: 'string' } as Unknown
        // bigint is not representable in JSON Schema; 'integer' is the closest approximation
        case 'bigint': return { type: 'integer' } as Unknown
        case 'unknown': return {} as Unknown
        case 'array': return { type: 'array', items: toJsonSchema(rest[0] as Type) } as Unknown
        case 'record': return { type: 'object', additionalProperties: toJsonSchema(rest[0] as Type) } as Unknown
        case 'or': return { anyOf: (rest as Type[]).map(toJsonSchema) } as Unknown
        default: return {} as Unknown
    }
}
