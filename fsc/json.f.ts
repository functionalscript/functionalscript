import { join0Plus, rangeEncode, range, remove, repeat0Plus, type Rule, set, type TerminalRange, option } from '../bnf/module.f.ts'

// space

const wsNoNewLineItem: Rule = set(' \t\r')

export const wsNoNewLine0: Rule = repeat0Plus(wsNoNewLineItem)

const wsItem: Rule = {
    wsNoNewLineItem,
    n: '\n',
}

export const ws0: Rule = () => option(ws1)

export const ws1: Rule = [wsItem, ws0]

//

export const json: Rule = () => ({
    object,
    array,
    number,
    string,
    true: 'true',
    false: 'false',
    null: 'null',
})

//

const separator: Rule = [',', ws0]

// object

const member: Rule = () => [string, ws0, ':', ws0, json, ws0]

const object: Rule = ['{', ws0, join0Plus(member, separator), '}']

// array

const element: Rule = [json, ws0]

const array: Rule = ['[', ws0, join0Plus(element, separator), ']']

// string

const character: Rule = () => ({
    ...remove(unicode, set('"\\')),
    '\\': ['\\', escape],
})

const string: Rule = ['"', repeat0Plus(character), '"']

export const unicode: TerminalRange = rangeEncode(0x20, 0x10FFFF)

const escape: Rule = () => ({
    ...set('"\\/bfnrt'),
    'u': ['u', hex, hex, hex, hex] // 117
})

const hex: Rule = () => ({
    digit,
    upper: range('AF'),
    lower: range('af'),
})

// number

const number: Rule = () => ({
    uNumber,
    minus: ['-', uNumber],
})

const uNumber: Rule = () => [uint, fraction0, exponent0]

const uint: Rule = () => ({
    '0': '0',
    '19': [range('19'), digits0]
})

export const digit: Rule = range('09')

const digits0: Rule = repeat0Plus(digit)

const digits1: Rule = [digit, digits0]

const fraction0: Rule = option(['.', digits1])

const exponent0: Rule = () => option([e, sign, digits1])

const e: Rule = set('eE')

const sign: Rule = option({
    '+': '+',
    '-': '-',
})
