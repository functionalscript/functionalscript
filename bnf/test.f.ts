import { set, type DataRule, type Rule } from './module.f.ts'
import * as j from '../json/module.f.ts'
import { sort } from '../types/object/module.f.ts'

// {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
const ws = () => ({ or: [
    [],
    ['\t', ws], // 9
    ['\n', ws], // 10
    ['\r', ws], // 13
    [' ', ws],  // 32
]})

// {"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}
const sign = { or: [
    [],
    '+', // 43
    '-', // 45
]}

// {"empty":false,"map":[[false,47],[true,57]]}
const digits = () => ({ or: [
    digit,
    [digit, digits]
]})

// {"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}
const exponent = { or: [
    [],
    ['E', sign, digits], // 69
    ['e', sign, digits], // 101
]}

// {"empty":true,"map":[[false,45],[true,46]]}
const fraction = { or: [
    [],
    ['.', digits] // 46
]}

// {"empty":false,"map":[[false,48],[true,57]]}
const onenine = [0x31, 0x39] as const

// {"empty":false,"map":[[false,47],[true,57]]}
const digit = { or: [
    '0',
    onenine,
]}

// {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
const members = (): DataRule => ({ or: [
    member,
    [member, '.', members],
]})

// {"empty":false,"map":[[false,122],[true,123]]}
const object = { or: [
    ['{', ws, '}'],      // 123
    ['{', members, '}'],
]}

// {"empty":false,"map":[[false,90],[true,91]]}
const array = (): DataRule => ({ or: [
    ['[', ws, ']'],      // 91
    ['[', element, ']'],
]})

const hex = { or: [
    digit,
    [0x41, 0x46], // A..F
    [0x61, 0x66], // a..f
]} as const

const escape = { or: [
    '"',
    '\\',
    '/',
    'b',
    'f',
    'n',
    'r',
    't',
    ['u', hex, hex, hex, hex]
]}

const character: Rule = { or: [
    [0x20, 0x21], // exclude '"' 0x22
    [0x23, 0x5B], // exclude '\' 0x5C
    [0x5D ,0x10FFFF],
    ['\\', escape],
]} as const

const characters = () => ({ or: [
    [],
    [character, characters]
]})

// {"empty":false,"map":[[false,33],[true,34]]}
const string = ['"', characters, '"']

// {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
const integer = { or: [
    digit,                  // 48-57
    [onenine, digits],
    ['-', digit],           // 45
    ['-', onenine, digits],
]}

// {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
const number = [integer, fraction, exponent]

// {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
const value = { or: [
    string,  // 34
    number,  // 45, 48-57
    array,   // 91
    'false', // 102
    'null',  // 110
    'true',  // 116
    object,  // 123
]}

const element = [ws, value, ws]

// ws: {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
// string: {"empty":false,"map":[[false,33],[true,34]]}
// {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
const member = [ws, string, ws, ':', element]

const json: Rule = element

//

const stringify = j.stringify(sort)

const eq = (a: Rule, e: string) => () => {
    const r = stringify(set(a))
    if (r !== e) { throw [r, e] }
}

export default {
    ws: eq(ws, '{"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}'),
    sign: eq(sign, '{"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}'),
    digits: eq(digits, '{"empty":false,"map":[[false,47],[true,57]]}'),
    exponent: eq(exponent, '{"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}'),
    fraction: eq(fraction, '{"empty":true,"map":[[false,45],[true,46]]}'),
    onenine: eq(onenine, '{"empty":false,"map":[[false,48],[true,57]]}'),
    digit: eq(digit, '{"empty":false,"map":[[false,47],[true,57]]}'),
    string: eq(string, '{"empty":false,"map":[[false,33],[true,34]]}'),
    member: eq(member, '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}'),
    members: eq(members, '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}'),
    object: eq(object, '{"empty":false,"map":[[false,122],[true,123]]}'),
    array: eq(array, '{"empty":false,"map":[[false,90],[true,91]]}'),
    integer: eq(integer, '{"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}'),
    number: eq(number, '{"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}'),
    value: eq(value, '{"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
}
