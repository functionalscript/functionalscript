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
 * @import { Rule, Thunk } from '../../types.ts'
 */

import { createValue, digit, optionFloatSuffix, optionNeg, string, uint, ws, wsSymbol } from '../json/module.f.mjs'
import { range, repeatFrom0, repeatFrom1 } from '../../module.f.mjs'

const uNumber = /**@type {const}*/({
    finite: [uint, { n: 'n', optionFloatSuffix }],
    infinity: 'Infinity'
})

const number = /**@type {const}*/([optionNeg, uNumber])

const letter = /**@type {const}*/({
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
})

const id = /**@type {const}*/(['$', repeatFrom0({ letter, digit })])

const property = /**@type {const}*/({
    string,
    proto: '["__proto__"]',
})

/** @type {Thunk} */
const value = () => ['const', {
    ...createValue(property, value),
    number, // replace the JSON number
    nan: 'NaN',
    undefined: 'undefined',
    id,
}]

const ws1 = repeatFrom1(wsSymbol)

/**
 * A statement is its keyword prefix, then a value, then `;`, with whitespace
 * allowed before and after the terminator. The prefix keeps its arity, so
 * the AST of a statement is a tuple rather than a list.
 *
 * @type {<const V extends readonly Rule[]>(...v: V) =>
 *  readonly [...V, Thunk, typeof ws, ';', typeof ws]}
 */
const statement = (...v) => [
    ...v,
    value,
    ws,
    ';',
    ws
]

export const dataJs = /**@type {const}*/([
    ws,
    repeatFrom0(statement('const', ws1, id, ws, '=', ws)),
    statement('export', ws1, 'default', ws1)
])

// const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];
// export default [4,{},{}];
