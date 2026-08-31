/**
 * DataJS grammar.
 *
 * The only allowed spelling of the `__proto__` property is the exact sequence
 * `["__proto__"]`; whitespace is not allowed anywhere within that sequence.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 */

import { createValue, digit, optionFloatSuffix, optionNeg, string, uint, ws, wsSymbol } from '../json/module.f.mjs'
import { option, range, repeat0Plus, repeat1Plus } from '../../module.f.mjs'

const uNumber = {
    finite: [uint, { n: 'n', optionFloatSuffix }],
    infinity: 'Infinity'
}

const number = [optionNeg, uNumber]

const letter = {
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
}

const id = ['$', repeat0Plus({ letter, digit })]

const property = {
    string,
    proto: '["__proto__"]',
}

const value = () => ({
    ...createValue(property, value),
    number, // replace the JSON number
    nan: 'NaN',
    undefined: 'undefined',
    id,
})

const ws1 = repeat1Plus(wsSymbol)

/** @type {(...v: readonly Rule[]) => Rule} */
const statement = (...v) => [...v, value, ws, ';', ws]

export const dataJs = [
    ws,
    repeat0Plus(statement('const', ws1, id, ws, '=', ws)),
    statement('export', ws1, 'default', ws1)
]

// const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];
// export default [4,{},{}];
