/**
 * Converts an rtti schema to a JSON Schema (draft 2020-12) object.
 *
 * Mirrors the visitor structure of `fs/types/rtti/ts/module.f.ts` (`printer` / `toTs`),
 * but emits a JSON Schema object instead of a TypeScript type string.
 *
 * @module
 */
import { type Const, type Type as RttiType, array, option, or, record, string } from '../../types/rtti/module.f.ts'
import type { Ts, WithOut } from '../../types/rtti/ts/module.f.ts'
import { unknown as jsonUnknown } from '../module.f.ts'

const unknownThunk = () => ['const', unknownConst] as const

/** rtti schema for a JSON Schema (draft 2020-12) document. */
export const unknown: WithOut<typeof unknownThunk, UnknownConst> = unknownThunk

/** A JSON Schema (draft 2020-12) document — the subset of keywords that `toJsonSchema` emits. */
export type Unknown = Ts<typeof unknown>

const unknownConst = {
    type: or('boolean', 'number', 'string', 'integer', 'array', 'object', undefined),
    const: option(jsonUnknown),
    not: option(unknown),
    anyOf: option(array(unknown)),
    items: or(unknown, false, undefined),
    prefixItems: option(array(unknown)),
    properties: option(record(unknown)),
    required: option(array(string)),
    additionalProperties: option(unknown),
} as const

/** Hand-written base type used as the `$out` annotation on `unknown`. */
type UnknownConst = {
    readonly type?: Ts<typeof unknownConst.type>
    readonly const?: Ts<typeof unknownConst.const>
    readonly not?: Ts<typeof unknownConst.not>
    readonly anyOf?: Ts<typeof unknownConst.anyOf>
    readonly items?: Ts<typeof unknownConst.items>
    readonly prefixItems?: Ts<typeof unknownConst.prefixItems>
    readonly properties?: Ts<typeof unknownConst.properties>
    readonly required?: Ts<typeof unknownConst.required>
    readonly additionalProperties?: Ts<typeof unknownConst.additionalProperties>
}

/** Returns true if the rtti schema admits the value `undefined`. */
const admitsUndefined = (rtti: RttiType): boolean => {
    if (rtti === undefined) { return true }
    if (typeof rtti !== 'function') { return false }
    const [t, ...r] = rtti()
    return t === 'or' ? r.some(admitsUndefined) : false
}

/** Returns the schema with `undefined` removed from any top-level `or`. */
const stripUndefined = (rtti: RttiType): RttiType => {
    if (typeof rtti !== 'function') { return rtti }
    const [t, ...r] = rtti()
    if (t !== 'or') { return rtti }
    const rest = r.flatMap(t => t !== undefined ? [t] : [])
    return rest.length === 1 ? rest[0] : or(...rest)
}

const constToJsonSchema = (rtti: Const): Unknown => {
    if (typeof rtti === 'undefined') { return { not: {} } }
    if (typeof rtti !== 'object' || rtti === null) {
        // bigint consts are represented as numbers (lossy for |value| > MAX_SAFE_INTEGER)
        return { const: typeof rtti === 'bigint' ? Number(rtti) : rtti }
    }
    if (rtti instanceof Array) {
        return {
            type: 'array',
            prefixItems: rtti.map(toJsonSchema),
            items: false,
        }
    }
    // Struct: keys not admitting undefined go into `required`; optional keys have
    // undefined stripped from their property schema. additionalProperties is omitted
    // (lenient), matching rtti's open-struct validation semantics.
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
export const toJsonSchema = (rtti: RttiType): Unknown => {
    if (typeof rtti !== 'function') { return constToJsonSchema(rtti) }
    const [tag, ...rest] = rtti()
    switch (tag) {
        case 'const': return constToJsonSchema(rest[0] as Const)
        case 'boolean': return { type: 'boolean' }
        case 'number': return { type: 'number' }
        case 'string': return { type: 'string' }
        // bigint is not representable in JSON Schema; 'integer' is the closest approximation
        case 'bigint': return { type: 'integer' }
        case 'unknown': return {}
        case 'array': return { type: 'array', items: toJsonSchema(rest[0]) }
        case 'record': return { type: 'object', additionalProperties: toJsonSchema(rest[0]) }
        case 'or': return { anyOf: rest.map(toJsonSchema) }
        default: return {}
    }
}
