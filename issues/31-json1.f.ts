type TerminalRange = readonly[number, number]

// JSON: https://www.json.org/json-en.html
{
    type Sequence = readonly Rule[]
    type Or = { readonly or: Sequence }

    type DataRule = Sequence|Or|TerminalRange|string

    //
    type LazyRule = () => DataRule
    type Rule = DataRule|LazyRule

    // ok
    const ws = () => ({ or: [
        [],
        [' ', ws],
        ['\t', ws],
        ['\n', ws],
        ['\r', ws],
    ]})

    // ok
    const sign = { or: [
        [],
        '+',
        '-',
    ]}

    const digits = () => [digit, ({ or: [
        [],
        digits
    ]})]

    const exponent = { or: [
        [],
        ['E', sign, digits],
        ['e', sign, digits],
    ]}

    const fraction = { or: [
        [],
        ['.', digits]
    ]}

    const onenine = [0x31, 0x39] as const

    const digit = { or: [
        '0',
        onenine,
    ]}

    //

    const members = (): DataRule => ({ or: [
        member,
        [member, ',', members],
    ]})

    const object = { or: [
        ['{', ws, '}'],
        ['{', members, '}'],
    ]}

    const array = (): DataRule => ({ or: [
        ['[', ws, ']'],
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

    const string = ['"', characters, '"']

    const integer = { or: [
        digit,
        [onenine, digits],
        ['-', digit],
        ['-', onenine, digits],
    ]}

    const number = [integer, fraction, exponent]

    const value = { or: [
        object,
        array,
        string,
        number,
        'true',
        'false',
        'null'
    ]}

    const element = [ws, value, ws]

    const member = [ws, string, ws, ':', element]

    const json: Rule = element
}
