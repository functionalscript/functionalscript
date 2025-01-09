import { cp, range, remove, type Rule, set, str, type TerminalRange } from '../bnf/func/module.f.ts'

export const json: Rule = () => [
    [object],
    [array],
    [number],
    [string],
    str('true'),
    str('false'),
    str('null'),
]

// object

const object: Rule = () => [
    [cp('{'), ws0, members0, cp('}')]
]

const members0: Rule = () => [
    [],
    [membersTail1],
]

const membersTail1: Rule = () => [
    [string, ws0, cp(':'), ws0, json, ws0, membersTail0]
]

const membersTail0: Rule = () => [
    [],
    [cp(','), ws0, membersTail0]
]

// array

const array: Rule = () => [
    [cp('['), ws0, elements0, cp(']')]
]

const elements0: Rule = () => [
    [],
    [elements1],
]

const elements1: Rule = () => [
    [json, ws0, elementsTail0]
]

const elementsTail0: Rule = () => [
    [],
    [cp(','), ws0, elements1]
]

// string

const string: Rule = () => [[cp('"'), characters, cp('"')]]

const characters: Rule = () => [
    [],
    [character, characters],
]

export const unicode: TerminalRange = [0x20, 0x10FFFF]

const character: Rule = () => [
    ...remove(unicode, [cp('"'), cp('\\')]),
    [cp('\\'), escape],
]

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

const digits0: Rule = () => [
    [],
    [digits1],
]

const digits1: Rule = () => [
    [digit, digits0]
]

export const digit: Rule = () => [[range('09')]]

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
