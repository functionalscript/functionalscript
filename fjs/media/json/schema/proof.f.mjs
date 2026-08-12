/**
 * @import { Unknown as JsonValue } from '../types.ts'
 * @import { Unknown } from './module.f.mjs'
 */

import { boolean, number, string, bigint, unknown, array, record, or, option } from '../../../types/rtti/module.f.mjs'
import { stringify } from '../module.f.mjs'
import { toJsonSchema, unknown as schemaUnknown } from './module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {(v: Unknown) => string} */
const serialize = v => stringify(e => e)(/** @type {JsonValue} */ (/** @type {unknown} */ (v)))

/** @type {(rtti: Parameters<typeof toJsonSchema>[0], expected: Unknown) => () => void} */
const eq = (rtti, expected) => () => {
    const result = serialize(toJsonSchema(rtti))
    const exp = serialize(expected)
    assertEq(result, exp, [result, exp])
}

export const proof = {
    tag0: {
        boolean: eq(boolean, { type: 'boolean' }),
        number: eq(number, { type: 'number' }),
        string: eq(string, { type: 'string' }),
        bigint: eq(bigint, { type: 'integer' }),
        unknown: eq(unknown, {}),
    },
    const: {
        null: eq(null, { const: null }),
        true: eq(true, { const: true }),
        false: eq(false, { const: false }),
        number: eq(/** @type {const} */ (42), { const: 42 }),
        string: eq(/** @type {const} */ ('hello'), { const: 'hello' }),
        undefined: eq(undefined, { not: {} }),
        bigint: eq(/** @type {const} */ (7n), { const: 7 }),
    },
    array: eq(array(number), { type: 'array', items: { type: 'number' } }),
    record: eq(record(string), { type: 'object', additionalProperties: { type: 'string' } }),
    or: eq(or(string, number), { anyOf: [{ type: 'string' }, { type: 'number' }] }),
    tuple: eq(/** @type {const} */ ([number, string]), {
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
    }),
    struct: {
        allRequired: eq(/** @type {const} */ ({ x: number, y: string }), {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x', 'y'],
        }),
        withOptional: eq(/** @type {const} */ ({ x: number, y: option(string) }), {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x'],
        }),
        allOptional: eq(/** @type {const} */ ({ x: option(number) }), {
            type: 'object',
            properties: { x: { type: 'number' } },
        }),
        empty: eq(/** @type {const} */ ({}), { type: 'object', properties: {} }),
        orOptional: eq(/** @type {const} */ ({ x: or(string, number, undefined) }), {
            type: 'object',
            properties: { x: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
        }),
        withConst: eq(/** @type {const} */ ({ x: null, y: string }), {
            type: 'object',
            properties: { x: { const: null }, y: { type: 'string' } },
            required: ['x', 'y'],
        }),
    },
    schemaUnknownTag: () => {
        const r = schemaUnknown()
        assert(r[0] === 'const')
    },
    nested: {
        arrayOfRecords: eq(array(record(boolean)), {
            type: 'array',
            items: { type: 'object', additionalProperties: { type: 'boolean' } },
        }),
        orWithConst: eq(or(null, string, /** @type {const} */ (42)), {
            anyOf: [{ const: null }, { type: 'string' }, { const: 42 }],
        }),
        structWithOr: eq(/** @type {const} */ ({ id: or(string, number), name: option(string) }), {
            type: 'object',
            properties: {
                id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                name: { type: 'string' },
            },
            required: ['id'],
        }),
    },
}
