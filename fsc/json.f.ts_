import { cp, join0, range, remove, repeat0, type Rule, set, str, type TerminalRange } from '../bnf/func/module.f.ts'

// space

const wsNoNewLineItem: Rule = () => set(' \t\r')

export const wsNoNewLine0: Rule = () => [
    [],
    [wsNoNewLineItem, wsNoNewLine0],
]

const wsItem: Rule = () => [
    [wsNoNewLineItem],
    str('\n'),
]

export const ws0: Rule = () => [
    [],
    [ws1],
]

export const ws1: Rule = () => [
    [wsItem, ws0]
]

//

export const json: Rule = () => [
    [object],
    [array],
    [number],
    [string],
    str('true'),
    str('false'),
    str('null'),
]

//

const separator: Rule = () => [[cp(','), ws0]]

// object

const member: Rule = () => [[string, ws0, cp(':'), ws0, json, ws0]]

const object: Rule = () => [
    [cp('{'), ws0, join0(member, separator), cp('}')]
]

// array

const element: Rule = () => [
    [json, ws0]
]

const array: Rule = () => [
    [cp('['), ws0, join0(element, separator), cp(']')]
]

// string

const character: Rule = () => [
    ...remove(unicode, [cp('"'), cp('\\')]),
    [cp('\\'), escape],
]

const string: Rule = () => [[cp('"'), repeat0(character), cp('"')]]

export const unicode: TerminalRange = [0x20, 0x10FFFF]

const escape: Rule = () => [
    ...set('"\\/bfnrt'),
    [cp('u'), hex, hex, hex, hex] // 117
]

const hex: Rule = () => [
    [digit],
    [range('AF')],
    [range('af')],
]

// number

const number: Rule = () => [
    [uNumber],
    [cp('-'), uNumber],
]

const uNumber: Rule = () => [
    [uint, fraction0, exponent0],
]

const uint: Rule = () => [
    str('0'),
    [range('19'), digits0]
]

export const digit: Rule = () => [[range('09')]]

const digits0: Rule = repeat0(digit)

const digits1: Rule = () => [
    [digit, digits0]
]

const fraction0: Rule = () => [
    [],
    [cp('.'), digits1]
]

const exponent0: Rule = () => [
    [],
    [e, sign, digits1],
]

const e: Rule = () => set('eE')

const sign: Rule = () => [
    [],
    [cp('+')],
    [cp('-')],
]
