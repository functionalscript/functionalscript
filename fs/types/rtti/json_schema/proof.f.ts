import { boolean, number, string, bigint, unknown, array, record, or, option } from '../module.f.ts'
import { toJsonSchema } from './module.f.ts'

const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) { return true }
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { return false }
    if (Array.isArray(a) !== Array.isArray(b)) { return false }
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) { return false }
    return aKeys.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const eq = (rtti: Parameters<typeof toJsonSchema>[0], expected: unknown) => () => {
    const result = toJsonSchema(rtti)
    if (!deepEqual(result, expected)) { throw [result, expected] }
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
        number: eq(42 as const, { const: 42 }),
        string: eq('hello' as const, { const: 'hello' }),
        undefined: eq(undefined, { not: {} }),
        bigint: eq(7n as const, { const: 7 }),
    },
    array: eq(array(number), { type: 'array', items: { type: 'number' } }),
    record: eq(record(string), { type: 'object', additionalProperties: { type: 'string' } }),
    or: eq(or(string, number), { anyOf: [{ type: 'string' }, { type: 'number' } ] }),
    tuple: eq([number, string] as const, {
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
    }),
    struct: {
        allRequired: eq({ x: number, y: string } as const, {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x', 'y'],
        }),
        withOptional: eq({ x: number, y: option(string) } as const, {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x'],
        }),
        allOptional: eq({ x: option(number) } as const, {
            type: 'object',
            properties: { x: { type: 'number' } },
        }),
        empty: eq({} as const, { type: 'object', properties: {} }),
    },
    nested: {
        arrayOfRecords: eq(array(record(boolean)), {
            type: 'array',
            items: { type: 'object', additionalProperties: { type: 'boolean' } },
        }),
        orWithConst: eq(or(null, string, 42 as const), {
            anyOf: [{ const: null }, { type: 'string' }, { const: 42 }],
        }),
        structWithOr: eq({ id: or(string, number), name: option(string) } as const, {
            type: 'object',
            properties: {
                id: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                name: { type: 'string' },
            },
            required: ['id'],
        }),
    },
}
