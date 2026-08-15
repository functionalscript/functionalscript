/**
 * @import { Unknown as JsonValue } from '../types.ts'
 * @import { Unknown } from './module.f.mjs'
 * @import { Data } from '../../../types/rtti/data/types.ts'
 */

import { boolean, number, string, bigint, never, unknown, array, record, or, option } from '../../../types/rtti/module.f.mjs'
import { stringify } from '../module.f.mjs'
import { dataToJsonSchema, toJsonSchema, unknown as schemaUnknown } from './module.f.mjs'
import { unitBit } from '../../../types/rtti/data/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {(v: Unknown) => string} */
const serialize = v => stringify(e => e)(/** @type {JsonValue} */ (v))

/** @type {(rtti: Parameters<typeof toJsonSchema>[0], expected: Unknown) => () => void} */
const eq = (rtti, expected) => () => {
    const result = serialize(toJsonSchema(rtti))
    const exp = serialize(expected)
    assertEq(result, exp, [result, exp])
}

/** @type {(data: Data, expected: Unknown) => () => void} */
const eqData = (data, expected) => () => {
    const result = serialize(dataToJsonSchema(data))
    const exp = serialize(expected)
    assertEq(result, exp, [result, exp])
}

/** A recursive list: `type _List = readonly _List[]`. */
/** @typedef {() => readonly ['array', _List]} _List */
/** @type {_List} */
const list = () => ['array', list]

/** Mutual recursion through a container. */
/** @typedef {() => readonly ['or', typeof number, _Forest]} _Tree */
/** @typedef {() => readonly ['array', _Tree]} _Forest */
/** @type {_Tree} */
const tree = () => ['or', number, forest]
/** @type {_Forest} */
const forest = () => ['array', tree]

/** The recursive revision lock schema. Its cycle closes through the
 * anonymous `or` thunk, which becomes the (empty-string-named) rule. */
/** @typedef {() => readonly ['record', () => readonly ['or', typeof string, _Lock]]} _Lock */
/** @type {_Lock} */
const lock = () => ['record', or(string, lock)]

/** Self-recursive record. */
/** @typedef {() => readonly ['record', _Rec]} _Rec */
/** @type {_Rec} */
const rec = () => ['record', rec]

const listRef = /** @type {const} */ ({ $ref: '#/$defs/list' })
const treeRef = /** @type {const} */ ({ $ref: '#/$defs/tree' })

/** @type {Unknown} */
const listDef = { type: 'array', items: listRef }

/** @type {Unknown} */
const treeDef = { anyOf: [{ type: 'number' }, { type: 'array', items: treeRef }] }

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
    // `anyOf` members follow the canonical kind order, not the operand order
    or: eq(or(string, number), { anyOf: [{ type: 'number' }, { type: 'string' }] }),
    tuple: eq(/** @type {const} */ ([number, string]), {
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        minItems: 2,
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
        // an unconstrained struct is the whole object kind
        empty: eq(/** @type {const} */ ({}), { type: 'object' }),
        orOptional: eq(/** @type {const} */ ({ x: or(string, number, undefined) }), {
            type: 'object',
            properties: { x: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
        }),
        withConst: eq(/** @type {const} */ ({ x: null, y: string }), {
            type: 'object',
            properties: { x: { const: null }, y: { type: 'string' } },
            required: ['x', 'y'],
        }),
        optionalOfEveryKind: eq(/** @type {const} */ ({
            a: option(number),
            b: option(string),
            c: option(bigint),
            d: option(array(number)),
            e: option(record(string)),
            f: or(null, undefined),
        }), {
            type: 'object',
            properties: {
                a: { type: 'number' },
                b: { type: 'string' },
                c: { type: 'integer' },
                d: { type: 'array', items: { type: 'number' } },
                e: { type: 'object', additionalProperties: { type: 'string' } },
                f: { const: null },
            },
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
            anyOf: [{ const: null }, { const: 42 }, { type: 'string' }],
        }),
        structWithOr: eq(/** @type {const} */ ({ id: or(string, number), name: option(string) }), {
            type: 'object',
            properties: {
                id: { anyOf: [{ type: 'number' }, { type: 'string' }] },
                name: { type: 'string' },
            },
            required: ['id'],
        }),
        topInsideTuple: eq(/** @type {const} */ ([unknown, number]), {
            type: 'array',
            prefixItems: [{}, { type: 'number' }],
            minItems: 2,
            items: false,
        }),
    },
    normalization: {
        booleanFromConsts: eq(or(true, false), { type: 'boolean' }),
        unitMembers: eq(or(null, undefined, true), {
            anyOf: [{ const: null }, { not: {} }, { const: true }],
        }),
        literalAbsorbed: eq(or(/** @type {const} */ (42), number), { type: 'number' }),
        duplicateLiteral: eq(or(/** @type {const} */ (1), /** @type {const} */ (1)), { const: 1 }),
        never: eq(never, { not: {} }),
        emptyTuple: eq(/** @type {const} */ ([]), { type: 'array', items: false }),
        // `readonly [number] ⊂ readonly number[]` — the tuple pattern is dropped
        coverageCollapse: eq(or(/** @type {const} */ ([number]), array(number)), {
            type: 'array',
            items: { type: 'number' },
        }),
        commutative: () => {
            const a = serialize(toJsonSchema(or(string, number)))
            const b = serialize(toJsonSchema(or(number, string)))
            assertEq(a, b, [a, b])
        },
    },
    recursion: {
        selfList: eq(list, { ...listRef, $defs: { list: listDef } }),
        mutualEntry: eq(tree, { ...treeRef, $defs: { tree: treeDef } }),
        mutualInline: eq(forest, { type: 'array', items: treeRef, $defs: { tree: treeDef } }),
        recursiveUnion: eq(or(number, list), {
            anyOf: [{ type: 'number' }, { type: 'array', items: listRef }],
            $defs: { list: listDef },
        }),
        recursiveRecord: eq(rec, {
            $ref: '#/$defs/rec',
            $defs: { rec: { type: 'object', additionalProperties: { $ref: '#/$defs/rec' } } },
        }),
        optionalRecursiveProperty: eq(/** @type {const} */ ({ p: option(list) }), {
            type: 'object',
            properties: { p: { type: 'array', items: listRef } },
            $defs: { list: listDef },
        }),
        revisionLock: eq(lock, {
            type: 'object',
            additionalProperties: { $ref: '#/$defs/' },
            $defs: {
                '': {
                    anyOf: [
                        { type: 'string' },
                        { type: 'object', additionalProperties: { $ref: '#/$defs/' } },
                    ],
                },
            },
        }),
        sharedNonRecursive: () => {
            // a shared, non-recursive definition is inlined at each use — no `$defs`
            const person = /** @type {const} */ ({ name: string })
            /** @type {Unknown} */
            const personSchema = {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
            }
            eq(/** @type {const} */ ([person, person]), {
                type: 'array',
                prefixItems: [personSchema, personSchema],
                minItems: 2,
                items: false,
            })()
        },
    },
    data: (() => {
        /** @type {Data} */
        const tupleWithRest = [{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }]
        /** @type {Data} */
        const structWithRest = [{}, {
            object: [{ props: { a: { number: true } }, rest: { string: true } }],
        }]
        /** @type {Data} */
        const optionalByReference = [
            { r: { unit: unitBit(null) | unitBit(undefined), number: true } },
            { object: [{ props: { p: 'r' } }] },
        ]
        return {
            plain: eqData([{}, { number: true }], { type: 'number' }),
            tupleWithRest: eqData(tupleWithRest, {
                type: 'array',
                prefixItems: [{ type: 'number' }],
                minItems: 1,
                items: { type: 'string' },
            }),
            structWithRest: eqData(structWithRest, {
                type: 'object',
                properties: { a: { type: 'number' } },
                required: ['a'],
                additionalProperties: { type: 'string' },
            }),
            // a referenced definition admitting `undefined` makes the key
            // optional; the reference itself is kept as the property schema
            optionalByReference: eqData(optionalByReference, {
                type: 'object',
                properties: { p: { $ref: '#/$defs/r' } },
                $defs: { r: { anyOf: [{ const: null }, { not: {} }, { type: 'number' }] } },
            }),
        }
    })(),
    refEncoding: (() => {
        /** @type {Data} */
        const d = [
            {
                'a~b': { number: true },
                'a/b': { number: true },
                '%2F': { number: true },
                'a b': { number: true },
                'é': { number: true },
            },
            { array: [{ prefix: ['a~b', 'a/b', '%2F', 'a b', 'é'] }] },
        ]
        return eqData(d, {
            type: 'array',
            prefixItems: [
                { $ref: '#/$defs/a~0b' },
                { $ref: '#/$defs/a~1b' },
                { $ref: '#/$defs/%252F' },
                { $ref: '#/$defs/a%20b' },
                { $ref: '#/$defs/%C3%A9' },
            ],
            minItems: 5,
            items: false,
            $defs: {
                'a~b': { type: 'number' },
                'a/b': { type: 'number' },
                '%2F': { type: 'number' },
                'a b': { type: 'number' },
                'é': { type: 'number' },
            },
        })
    })(),
    throw: {
        missingRootDefinition: () => dataToJsonSchema([{}, 'nope']),
        // an `Object.prototype` member name is still a missing definition
        missingPrototypeDefinition: () => dataToJsonSchema([{}, 'toString']),
        missingNestedDefinition: () => {
            /** @type {Data} */
            const d = [{ a: { array: [{ prefix: [], rest: 'missing' }] } }, 'a']
            return dataToJsonSchema(d)
        },
    },
}
