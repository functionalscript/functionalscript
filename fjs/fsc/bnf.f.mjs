/**
 * @import { Rule } from '../bnf/types.ts'
 */

import { range, remove, set, option } from '../bnf/module.f.mjs'
import { digit, json, unicode, ws0, ws1, wsNoNewLine0 } from './json.f.mjs'

/** @type {Rule} */
export const wsModule = () => [ws0, module]

/** @type {Rule} */
const module = () => ({
    json: [json, ws0],
    fjs,
})

/** @type {Rule} */
const fjs = () => option({
    const: ['const', ws1, id, ws0, '=', ws0, json, wsNoNewLine0, fjsTail],
    export: ['export', ws1, 'default', ws1, json],
})

/** @type {Rule} */
const fjsTail = option(['\n', ws0, fjs])

// line comment

/** @type {Rule} */
const lineItem = remove(unicode, set('\n'))

/** @type {Rule} */
const line = () => option([lineItem, line])

/** @type {Rule} */
const lineComment = () => ['/', commentTail, '\n']

/** @type {Rule} */
const multiLineSkip = remove(unicode, set('/'))

/** @type {Rule} */
const multiLineItem = remove(unicode, set('*'))

/** @type {Rule} */
const multiLine = () => ({
    '*': ['*', multiLineTail],
    '_': [multiLineItem, multiLine]
})

/** @type {Rule} */
const multiLineTail = {
    '/': '/',
    '_': [multiLineSkip, multiLine]
}

/** @type {Rule} */
const commentTail = {
    '/': ['/', lineComment],
    '*': ['*', multiLine],
}

// id

/** @type {Rule} */
const id = () => [alpha, idTail0]

/** @type {Rule} */
const alpha = {
    upper: range('AZ'),
    lower: range('az'),
    _: set('_$'),
}

/** @type {Rule} */
const idTail0 = () => option([alphaDigit, idTail0])

/** @type {Rule} */
const alphaDigit = {
    alpha,
    digit,
}
