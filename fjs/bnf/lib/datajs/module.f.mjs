/** @import { Rule } from '../../types.ts' */

import { string } from '../../../rtti/module.f.mjs'
import { array, createValue, digit, false_, null_, object, optionFloatSuffix, optionNeg, true_, uint, ws, wsSymbol } from '../json/module.f.mjs'
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

const id = ['$', option({ letter, digit })]

const property = {
    string,
    proto: '["__proto__"]',
}

const value = () => ({
    ...createValue(value),
    number, // replace the JSON number
    nan: 'NaN',
    undefined: 'undefined',
    id,
})

const ws1 = repeat1Plus(wsSymbol)

/** @type {(...v: readonly Rule[]) => Rule} */
const statement = (...v) => [...v, value, ws, ';', ws]

export const datajs = [
    ws,
    repeat0Plus(statement('const', ws1, id, ws, '=', ws)),
    statement('export', ws1, 'default', ws1)
]
