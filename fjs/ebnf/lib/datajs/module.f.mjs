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
 * @import { DataJsValue } from './types.ts'
 */

import { createValue, digit, optionFloatSuffix, optionNeg, string, uint, ws, wsSymbol } from '../json/module.f.mjs'
import { range, repeatFrom0, repeatFrom1 } from '../../module.f.mjs'

const uNumber = /**@type {const}*/({
    finite: [uint, { n: 'n', optionFloatSuffix }],
    infinity: 'Infinity'
})

/**
 * A number is JSON's with a bigint suffix on the integer form and `Infinity`
 * as a word; the sign is shared by all three.
 */
export const number = /**@type {const}*/([optionNeg, uNumber])

const letter = /**@type {const}*/({
    lo: range('az'),
    up: range('AZ'),
    _: '_',
    $: '$',
})

/** A `const` name, and a reference to one: `$` followed by letters, digits, `_` and `$`. */
export const id = /**@type {const}*/(['$', repeatFrom0({ letter, digit })])

/**
 * An object key: a JSON string, or the one spelling of `__proto__`, which is
 * a literal — no whitespace inside it and no escapes.
 */
export const property = /**@type {const}*/({
    string,
    proto: '["__proto__"]',
})

/**
 * A value contains values, so the rule names itself through a thunk, as
 * JSON's does; the type names itself the same way, in `./types.ts`.
 *
 * @type {DataJsValue}
 */
export const value = () => ['const', {
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
 *  readonly [...V, DataJsValue, typeof ws, ';', typeof ws]}
 */
const statement = (...v) => [
    ...v,
    value,
    ws,
    ';',
    ws
]

/** `const $name = value;` — the whitespace after `const` is mandatory. */
export const constStatement = statement('const', ws1, id, ws, '=', ws)

/** `export default value;` — with mandatory whitespace on both sides of `default`. */
export const exportStatement = statement('export', ws1, 'default', ws1)

/** A document: one whitespace run, the declarations, and the export. */
export const dataJs = /**@type {const}*/([
    ws,
    repeatFrom0(constStatement),
    exportStatement
])

// const $0={["__proto__"]:"world!"};const $1=[3,5n];export default [4,$0,$1];
// export default [4,{},{}];
