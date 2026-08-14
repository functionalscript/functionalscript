/**
 * @import { Type } from '../types.ts'
 */

import { printer } from './module.f.mjs'
import { boolean, number, string, bigint, unknown, array, record, or, option, never } from '../module.f.mjs'

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
        emptyTuple: () => eq([], 'readonly[]'),
        tuple: () => eq([12, true], 'readonly[12,true]'),
        emptyStruct: () => eq({}, '{}'),
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
    never: () => eq(never, 'never'),
    option: () => eq(option(number), 'number|undefined'),
    mut: {
        array: () => eqMut(array(number), '(number)[]'),
        nestedArray: () => eqMut(array(array(boolean)), '((boolean)[])[]'),
        record: () => eqMut(record(string), '{[k in string]?:string}'),
        tuple: () => eqMut([12, true], '[12,true]'),
        struct: () => eqMut({ a: number, b: string }, '{"a":number,"b":string}'),
    },
}
