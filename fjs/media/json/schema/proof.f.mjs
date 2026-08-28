/**
 * @import { Unknown } from './module.f.mjs'
 * @import { Data } from '../../../rtti/data/types.ts'
 */

import { boolean, number, string, bigint, never, unknown, array, open, record, or, option } from '../../../rtti/module.f.mjs'
import { stringify } from '../module.f.mjs'
import { dataToJsonSchema, toJsonSchema, unknown as schemaUnknown } from './module.f.mjs'
import { absentBit, unitBit } from '../../../rtti/data/module.f.mjs'
import { assert, assertEq } from '../../../asserts/module.f.mjs'

/** @type {(v: Unknown) => string} */
const serialize = v => stringify(e => e)(v)

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
    // A bare tuple is closed, which JSON Schema spells `items: false`; a
    // position admitting `undefined` may be absent instead, which is
    // `minItems`. `open` is what admits what follows the prefix, and prints
    // the unconstrained `items: {}`.
    tuple: {
        allRequired: eq(/** @type {const} */ ([number, string]), {
            type: 'array',
            prefixItems: [{ type: 'number' }, { type: 'string' }],
            minItems: 2,
            items: false,
        }),
        withOptional: eq(/** @type {const} */ ([number, or(option, string)]), {
            type: 'array',
            prefixItems: [{ type: 'number' }, { type: 'string' }],
            minItems: 1,
            items: false,
        }),
        allOptional: eq(/** @type {const} */ ([or(option, number)]), {
            type: 'array',
            prefixItems: [{ type: 'number' }],
            items: false,
        }),
        open: eq(open(/** @type {const} */ ([number, string])), {
            type: 'array',
            prefixItems: [{ type: 'number' }, { type: 'string' }],
            minItems: 2,
            items: {},
        }),
    },
    // The same on the other kind: a bare struct names every key it admits,
    // which is `additionalProperties: { not: {} }`.
    struct: {
        allRequired: eq(/** @type {const} */ ({ x: number, y: string }), {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x', 'y'],
            additionalProperties: { not: {} },
        }),
        withOptional: eq(/** @type {const} */ ({ x: number, y: or(option, string) }), {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x'],
            additionalProperties: { not: {} },
        }),
        allOptional: eq(/** @type {const} */ ({ x: or(option, number) }), {
            type: 'object',
            properties: { x: { type: 'number' } },
            additionalProperties: { not: {} },
        }),
        // a closed struct declaring nothing is the empty object
        empty: eq(/** @type {const} */ ({}), {
            type: 'object',
            additionalProperties: { not: {} },
        }),
        // an unconstrained struct is the whole object kind
        openEmpty: eq(open(/** @type {const} */ ({})), { type: 'object' }),
        open: eq(open(/** @type {const} */ ({ x: number, y: string })), {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'string' } },
            required: ['x', 'y'],
        }),
        orOptional: eq(/** @type {const} */ ({ x: or(option, string, number) }), {
            type: 'object',
            properties: { x: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
            additionalProperties: { not: {} },
        }),
        // a present `undefined` no longer spells optionality: the key is
        // required, and `stripUndefined` under-approximates its schema —
        // JSON has no way to write the `undefined` case
        orPresentUndefined: eq(/** @type {const} */ ({ x: or(string, undefined) }), {
            type: 'object',
            properties: { x: { type: 'string' } },
            required: ['x'],
            additionalProperties: { not: {} },
        }),
        withConst: eq(/** @type {const} */ ({ x: null, y: string }), {
            type: 'object',
            properties: { x: { const: null }, y: { type: 'string' } },
            required: ['x', 'y'],
            additionalProperties: { not: {} },
        }),
        optionalOfEveryKind: eq(/** @type {const} */ ({
            a: or(option, number),
            b: or(option, string),
            c: or(option, bigint),
            d: or(option, array(number)),
            e: or(option, record(string)),
            f: or(option, null),
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
            additionalProperties: { not: {} },
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
        orWithConst: eq(or(null, string, 42), {
            anyOf: [{ const: null }, { const: 42 }, { type: 'string' }],
        }),
        structWithOr: eq(/** @type {const} */ ({ id: or(string, number), name: or(option, string) }), {
            type: 'object',
            properties: {
                id: { anyOf: [{ type: 'number' }, { type: 'string' }] },
                name: { type: 'string' },
            },
            required: ['id'],
            additionalProperties: { not: {} },
        }),
        // the top position is required — the array cannot end before the
        // `number` after it — so its `undefined` is not stripped away
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
        literalAbsorbed: eq(or(42, number), { type: 'number' }),
        duplicateLiteral: eq(or(1, 1), { const: 1 }),
        never: eq(never, { not: {} }),
        // a closed tuple declaring nothing is the empty array
        emptyTuple: eq(/** @type {const} */ ([]), { type: 'array', items: false }),
        // an open one declaring nothing is the whole array kind
        openEmptyTuple: eq(open(/** @type {const} */ ([])), { type: 'array' }),
        // a longer tuple pattern is included in a shorter one when both are
        // open; closed, the two lengths are disjoint and both patterns stay
        coverageCollapse: eq(
            or(open([number, number]), open([number])),
            {
                type: 'array',
                prefixItems: [{ type: 'number' }],
                minItems: 1,
                items: {},
            }),
        noCollapseWhenClosed: eq(
            or(/** @type {const} */ ([number, number]), /** @type {const} */ ([number])),
            {
                anyOf: [
                    {
                        type: 'array',
                        prefixItems: [{ type: 'number' }],
                        minItems: 1,
                        items: false,
                    },
                    {
                        type: 'array',
                        prefixItems: [{ type: 'number' }, { type: 'number' }],
                        minItems: 2,
                        items: false,
                    },
                ],
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
        optionalRecursiveProperty: eq(/** @type {const} */ ({ p: or(option, list) }), {
            type: 'object',
            properties: { p: { type: 'array', items: listRef } },
            additionalProperties: { not: {} },
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
                additionalProperties: { not: {} },
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
            { r: { unit: unitBit(null) | absentBit, number: true } },
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
            // a referenced definition admitting absence makes the key
            // optional; the reference itself is kept as the property schema,
            // and the absent bit is masked from the definition — absence is
            // spelled by the key's omission from `required`, not by a member
            optionalByReference: eqData(optionalByReference, {
                type: 'object',
                properties: { p: { $ref: '#/$defs/r' } },
                $defs: { r: { anyOf: [{ const: null }, { type: 'number' }] } },
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
