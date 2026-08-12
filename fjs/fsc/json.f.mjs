import { join0Plus, rangeEncode, range, remove, repeat0Plus, set, option } from '../bnf/module.f.mjs'
/** @import { Rule, TerminalRange } from '../bnf/types.ts' */

// space

/** @type {Rule} */
const wsNoNewLineItem = set(' \t\r')

/** @type {Rule} */
export const wsNoNewLine0 = repeat0Plus(wsNoNewLineItem)

/** @type {Rule} */
const wsItem = {
    wsNoNewLineItem,
    n: '\n',
}

/** @type {Rule} */
export const ws0 = () => option(ws1)

/** @type {Rule} */
export const ws1 = [wsItem, ws0]

//

/** @type {Rule} */
export const json = () => ({
    object,
    array,
    number,
    string,
    true: 'true',
    false: 'false',
    null: 'null',
})

//

/** @type {Rule} */
const separator = [',', ws0]

// object

/** @type {Rule} */
const member = () => [string, ws0, ':', ws0, json, ws0]

/** @type {Rule} */
const object = ['{', ws0, join0Plus(member, separator), '}']

// array

/** @type {Rule} */
const element = [json, ws0]

/** @type {Rule} */
const array = ['[', ws0, join0Plus(element, separator), ']']

// string

/** @type {Rule} */
const character = () => ({
    ...remove(unicode, set('"\\')),
    '\\': ['\\', escape],
})

/** @type {Rule} */
const string = ['"', repeat0Plus(character), '"']

/** @type {TerminalRange} */
export const unicode = rangeEncode(0x20, 0x10FFFF)

/** @type {Rule} */
const escape = () => ({
    ...set('"\\/bfnrt'),
    'u': ['u', hex, hex, hex, hex] // 117
})

/** @type {Rule} */
const hex = () => ({
    digit,
    upper: range('AF'),
    lower: range('af'),
})

// number

/** @type {Rule} */
const number = () => ({
    uNumber,
    minus: ['-', uNumber],
})

/** @type {Rule} */
const uNumber = () => [uint, fraction0, exponent0]

/** @type {Rule} */
const uint = () => ({
    '0': '0',
    '19': [range('19'), digits0]
})

/** @type {Rule} */
export const digit = range('09')

/** @type {Rule} */
const digits0 = repeat0Plus(digit)

/** @type {Rule} */
const digits1 = [digit, digits0]

/** @type {Rule} */
const fraction0 = option(['.', digits1])

/** @type {Rule} */
const exponent0 = () => option([e, sign, digits1])

/** @type {Rule} */
const e = set('eE')

/** @type {Rule} */
const sign = option({
    '+': '+',
    '-': '-',
})
