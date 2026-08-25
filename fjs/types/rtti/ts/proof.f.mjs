/**
 * @import { Type } from '../types.ts'
 * @import { Data } from '../data/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { toData, unitBit } from '../data/module.f.mjs'
import { boolean, number, string, bigint, unknown, array, close, record, or, option, never } from '../module.f.mjs'
import { dataToTs, printer } from './module.f.mjs'

const toTs = printer()
const toTsMut = printer(true)

/** @type {(rtti: Type, expected: string) => void} */
const eqMut = (rtti, expected) => {
    const result = toTsMut(rtti)
    if (result !== expected) { throw `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}` }
}

/** @type {(rtti: Type, expected: string) => void} */
const eq = (rtti, expected) => {
    const result = toTs(rtti)
    if (result !== expected) { throw `expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}` }
}

/** @type {(data: Data, expected: unknown) => void} */
const eqData = (data, expected) => {
    const result = JSON.stringify(dataToTs()(data))
    const exp = JSON.stringify(expected)
    assertEq(result, exp, [result, exp])
}

/** A recursive list: `type list = readonly list[]`. */
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

/** A cycle closing through an anonymous `or` thunk — an empty rule name. */
/** @typedef {() => readonly ['record', () => readonly ['or', typeof string, _Lock]]} _Lock */
/** @type {_Lock} */
const lock = () => ['record', or(string, lock)]

/** A recursive rule whose function name is the predefined type name `string`. */
/** @typedef {() => readonly ['array', _StringNamed]} _StringNamed */
/** @type {{ readonly string: _StringNamed }} */
const stringNamedHolder = { string: () => ['array', stringNamedHolder.string] }
const stringNamed = stringNamedHolder.string

/** A recursive rule whose function name is `T0` — the first generated identifier. */
/** @typedef {() => readonly ['array', _T0Named]} _T0Named */
/** @type {{ readonly T0: _T0Named }} */
const t0NamedHolder = { T0: () => ['array', t0NamedHolder.T0] }
const t0Named = t0NamedHolder.T0

/** A recursive rule whose function name is the reserved word `if`. */
/** @typedef {() => readonly ['array', _IfNamed]} _IfNamed */
/** @type {{ readonly if: _IfNamed }} */
const ifNamedHolder = { if: () => ['array', ifNamedHolder.if] }
const ifNamed = ifNamedHolder.if

export const proof = {
    tag0: {
        boolean: () => eq(boolean, 'boolean'),
        number: () => eq(number, 'number'),
        string: () => eq(string, 'string'),
        bigint: () => eq(bigint, 'bigint'),
        unknown: () => eq(unknown, 'unknown'),
    },
    tag1: {
        array: {
            primitive: () => eq(array(number), 'readonly(number)[]'),
            nested: () => eq(array(array(boolean)), 'readonly(readonly(boolean)[])[]'),
            union: () => eq(array(or(number, string)), 'readonly(number|string)[]'),
        },
        record: {
            primitive: () => eq(record(string), '{readonly[k in string]?:string}'),
            nested: () => eq(record(record(number)), '{readonly[k in string]?:{readonly[k in string]?:number}}'),
        },
    },
    const: {
        null: () => eq(null, 'null'),
        undefined: () => eq(undefined, 'undefined'),
        true: () => eq(true, 'true'),
        false: () => eq(false, 'false'),
        number: () => eq(42, '42'),
        nan: () => eq(NaN, 'number'),
        inf: () => eq(Infinity, 'number'),
        negInf: () => eq(-Infinity, 'number'),
        string: () => eq('hello', '"hello"'),
        bigint: () => eq(7n, '7n'),
        // a tuple is open, and — unlike `Ts<T>`, which cannot say so
        // generically — the printer renders the rest element that says it, so
        // an unconstrained tuple is the whole array kind
        emptyTuple: () => eq([], 'readonly(unknown)[]'),
        unconstrainedTuple: () => eq([unknown], 'readonly(unknown)[]'),
        tuple: () => eq([12, true], 'readonly[12,true,...readonly(unknown)[]]'),
        // a position the array may end before prints optional, as the key it
        // is the array counterpart of does
        optionalTuplePosition: () => eq(
            [number, option(string)],
            'readonly[number,(undefined|string)?,...readonly(unknown)[]]',
        ),
        allOptionalTuple: () => eq(
            [option(number)],
            'readonly[(undefined|number)?,...readonly(unknown)[]]',
        ),
        // an unconstrained struct is the whole object kind
        emptyStruct: () => eq({}, '{readonly[k in string]?:unknown}'),
        struct: () => eq(
            { a: number, b: string },
            '{readonly"a":number,readonly"b":string}',
        ),
        nestedStruct: () => eq(
            { x: { y: boolean } },
            '{readonly"x":{readonly"y":boolean}}',
        ),
        quotedKey: () => eq(
            { 'my-key': number },
            '{readonly"my-key":number}',
        ),
        stringWithQuote: () => eq('say "hi"', '"say \\"hi\\""'),
        keyWithQuote: () => eq(
            { 'a"b': number },
            '{readonly"a\\"b":number}',
        ),
    },
    constThunk: {
        primitive: () => eq(() => ['const', 42n], '42n'),
        string: () => eq(() => ['const', 'hi'], '"hi"'),
    },
    or: {
        empty: () => eq(or(), 'never'),
        consts: () => eq(or(false, 42, 'hello'), 'false|42|"hello"'),
        thunks: () => eq(or(number, string), 'number|string'),
        mixed: () => eq(or(42, string), '42|string'),
    },
    // The closed forms. A tuple has a spelling for "these positions and no
    // more", so `close` prints exactly; an object type is structurally open in
    // TypeScript, so a closed struct prints as wide as it can be printed —
    // which is what an open one prints as too.
    close: {
        tuple: () => eq(close([12, true]), 'readonly[12,true]'),
        emptyTuple: () => eq(close([]), 'readonly[]'),
        // the position is still optional, and the array may still end before it
        optionalPosition: () => eq(
            close([number, option(string)]),
            'readonly[number,(undefined|string)?]',
        ),
        struct: () => eq(close({ a: number }), '{readonly"a":number}'),
        emptyStruct: () => eq(close({}), '{}'),
        // a declared `unknown` key is not dropped once the container is closed
        unknownProp: () => eq(close({ a: unknown }), '{readonly"a"?:unknown}'),
        // a stated rest prints as the rest element / index signature it is
        tupleRest: () => eq(close([number], string), 'readonly[number,...readonly(string)[]]'),
        structRest: () => eq(
            close({ a: number }, string),
            '{readonly"a":number}&{readonly[k in string]?:number|string}',
        ),
        // an unconstrained rest is openness again, on both kinds
        openAgain: () => {
            assertEq(toTs(close([number], unknown)), toTs([number]))
            assertEq(toTs(close({ a: number }, unknown)), toTs({ a: number }))
        },
        mut: () => eqMut(close([number], string), '[number,...(string)[]]'),
    },
    never: () => eq(never, 'never'),
    // an array with no admissible element is the empty array, and nothing
    // past a prefix is what prints as an exact-length tuple
    arrayOfNever: () => eq(array(never), 'readonly[]'),
    // union members follow the canonical kind order, `undefined` first
    option: () => eq(option(number), 'undefined|number'),
    normalization: {
        booleanFromConsts: () => eq(or(true, false), 'boolean'),
        literalAbsorbed: () => eq(or(42, number), 'number'),
        sortedLiterals: () => eq(or(2, 1), '1|2'),
        sortedBigints: () => eq(or(2n, 1n), '1n|2n'),
        canonicalIdentity: () => {
            assertEq(toTs(or(string, number)), toTs(or(number, string)))
        },
        // a key admitting `undefined` may be absent — it prints optional
        optionalProp: () => eq({ x: option(string) }, '{readonly"x"?:undefined|string}'),
        mixedProps: () => eq(
            { a: number, b: option(number) },
            '{readonly"a":number,readonly"b"?:undefined|number}'),
    },
    recursion: {
        selfList: () => {
            eq(list, 'list')
            eqData(toData(list), [[['list', 'readonly(list)[]']], 'list'])
        },
        mutual: () => {
            eqData(toData(tree), [[['tree', 'number|readonly(tree)[]']], 'tree'])
            eqData(toData(forest), [[['tree', 'number|readonly(tree)[]']], 'readonly(tree)[]'])
        },
        recursiveUnion: () => {
            eqData(toData(or(number, list)), [[['list', 'readonly(list)[]']], 'number|readonly(list)[]'])
        },
        mutable: () => {
            const [defs, entry] = dataToTs(true)(toData(list))
            assertEq(JSON.stringify([defs, entry]), JSON.stringify([[['list', '(list)[]']], 'list']))
        },
    },
    identifiers: {
        // the empty rule name is not an identifier — generated `T0`
        emptyName: () => {
            eqData(toData(lock), [
                [['T0', 'string|{readonly[k in string]?:T0}']],
                '{readonly[k in string]?:T0}',
            ])
        },
        // a predefined type name cannot name an alias — generated `T0`
        predefinedName: () => {
            eqData(toData(stringNamed), [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // reserved words cannot name an alias either — generated `T0`
        reservedName: () => {
            eqData(toData(ifNamed), [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        typeOperatorName: () => {
            eqData([{ infer: { array: [{ prefix: [], rest: 'infer' }] } }, 'infer'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // reserved only in strict-mode code — but every module is strict
        strictModeReservedName: () => {
            eqData([{ let: { array: [{ prefix: [], rest: 'let' }] } }, 'let'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
            eqData([{ intrinsic: { array: [{ prefix: [], rest: 'intrinsic' }] } }, 'intrinsic'],
                [[['T0', 'readonly(T0)[]']], 'T0'])
        },
        // a generated identifier skips names already kept
        generatedCollision: () => {
            eqData(toData(/** @type {const} */ ([t0Named, lock])), [
                [['T1', 'string|{readonly[k in string]?:T1}'], ['T0', 'readonly(T0)[]']],
                'readonly[T0,{readonly[k in string]?:T1},...readonly(unknown)[]]',
            ])
        },
    },
    data: {
        tupleWithRest: () => {
            eqData([{}, { array: [{ prefix: [{ number: true }], rest: { string: true } }] }],
                [[], 'readonly[number,...readonly(string)[]]'])
        },
        // an exact-length pattern is the one that prints without a rest
        // element — the closed tuple `Ts<>` renders for every tuple schema
        exactLengthTuple: () => {
            eqData([{}, { array: [{ prefix: [{ number: true }, { string: true }] }] }],
                [[], 'readonly[number,string]'])
        },
        structWithRest: () => {
            // the index signature must cover the declared keys too, so the
            // rest type widens to include the declared value types
            eqData([{}, { object: [{ props: { a: { number: true } }, rest: { string: true } }] }],
                [[], '{readonly"a":number}&{readonly[k in string]?:number|string}'])
            eqData([{}, { object: [{ props: { a: { string: true } }, rest: { string: true } }] }],
                [[], '{readonly"a":string}&{readonly[k in string]?:string}'])
        },
        optionalByReference: () => {
            eqData([{ r: { unit: unitBit(null) | unitBit(undefined), number: true } },
                { object: [{ props: { p: 'r' } }] }],
                [[['r', 'null|undefined|number']], '{readonly"p"?:r}'])
            eqData([{ r: { number: true } }, { object: [{ props: { p: 'r' } }] }],
                [[['r', 'number']], '{readonly"p":r}'])
        },
        wholeKinds: () => {
            eqData([{}, { array: true, object: true }],
                [[], 'readonly(unknown)[]|{readonly[k in string]?:unknown}'])
        },
    },
    mut: {
        array: () => eqMut(array(number), '(number)[]'),
        nestedArray: () => eqMut(array(array(boolean)), '((boolean)[])[]'),
        record: () => eqMut(record(string), '{[k in string]?:string}'),
        tuple: () => eqMut([12, true], '[12,true,...(unknown)[]]'),
        struct: () => eqMut({ a: number, b: string }, '{"a":number,"b":string}'),
    },
    throw: {
        // a dangling reference is malformed data
        missingDefinition: () => dataToTs()([{}, 'nope']),
    },
}
