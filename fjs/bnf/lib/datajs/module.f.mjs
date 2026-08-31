/**
 * DataJS grammar.
 *
 * The only allowed spelling of the `__proto__` property is the exact character
 * sequence `["__proto__"]`, with no whitespace or escape substitutions. This
 * grammar recognizes JSON string keys and `$` references syntactically. After
 * grammar recognition and before returning the parsed result, processing must
 * decode string-key escapes and reject a decoded `__proto__`, resolve references
 * against earlier `const` declarations, reject a duplicate `const` declaration,
 * and fail on an unresolved reference.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 */

import { createValue, digit, optionFloatSuffix, optionNeg, string, uint, ws, wsSymbol } from '../json/module.f.mjs'
import { range, repeat0Plus, repeat1Plus } from '../../module.f.mjs'

/** @type {Rule} */
const uNumber = {
    finite: [uint, { n: 'n', optionFloatSuffix }],
    infinity: 'Infinity'
}

/** @type {Rule} */
const number = [optionNeg, uNumber]

/** @type {Rule} */
const letter = {
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
}

/** @type {Rule} */
const id = ['$', repeat0Plus({ letter, digit })]

/** @type {Rule} */
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

/** @type {Rule} */
export const dataJs = [
    ws,
    repeat0Plus(statement('const', ws1, id, ws, '=', ws)),
    statement('export', ws1, 'default', ws1)
]

// const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];
// export default [4,{},{}];
