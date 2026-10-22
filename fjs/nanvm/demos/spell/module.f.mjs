/**
 * A value as a WASM demo page spells it: the text a spec page shows for
 * what its sample answered or threw, and the text the page compares
 * between the JavaScript call and the WebAssembly one.
 *
 * **A literal, not `String(value)`.** `String` flattens what a page is
 * there to show: `[undefined, null, ""]` and `[[1], 2]` read `,,` and
 * `1,2`, so two calls that answered different values would read the same.
 * Here a string is quoted, `null` and `undefined` are themselves, a
 * `bigint` carries its `n`, and an array and an object keep their nesting,
 * one line with no spaces, as `JSON.stringify` writes JSON: `[1,"s",null]`,
 * `{"a":1n}`. A number is what `String` writes for it, `NaN` and the
 * infinities included, and a function is `(function)`, which no literal
 * spells.
 *
 * `nanvm-demos` spells the WebAssembly call's answer the same way
 * (`spell` in `nanvm/demos/src/lib.rs`), so a page compares one text with
 * the other, and the generated Rust tests hold the Rust run to the answers
 * the samples list states for JavaScript.
 *
 * @module
 */

import { stringLiteral } from '../../../js/string_escape/module.f.mjs'

const { entries } = Object
const { isArray } = Array

/** @type {(value: unknown) => string} */
export const spell = value => {
    switch (typeof value) {
        case 'string': { return stringLiteral(value) }
        case 'bigint': { return `${value}n` }
        case 'function': { return '(function)' }
        case 'object': {
            if (value === null) { return 'null' }
            if (isArray(value)) { return `[${value.map(spell).join(',')}]` }
            return `{${entries(value).map(([k, v]) => `${stringLiteral(k)}:${spell(v)}`).join(',')}}`
        }
        default: { return String(value) }
    }
}
