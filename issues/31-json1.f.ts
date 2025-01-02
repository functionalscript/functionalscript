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

    // ok
    const onenine = [0x31, 0x39] as const

    // ok
    const digit = [0x30, 0x39] as const

    // ok
    const digits1 = (): DataRule => ({ or: [
        [],
        [[0x30, 0x39], digits1]
    ]})

    // ok
    const digits = [digit, digits1]

    // ok
    const exponent = { or: [
        [],
        ['E', sign, digits],
        ['e', sign, digits],
    ]}

    // ok
    const fraction = { or: [
        [],
        ['.', digits]
    ]}

    // ok
    const hex = { or: [
        [0x30, 0x39],
        [0x41, 0x46], // A..F
        [0x61, 0x66], // a..f
    ]} as const

    // ok
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

    // ok
    const characters = (): DataRule => ({ or: [
        [],
        [[0x20, 0x21], characters], // exclude '"' 0x22
        [[0x23, 0x5B], characters], // exclude '\' 0x5C
        [[0x5D ,0x10FFFF], characters],
        ['\\', escape, characters],
    ]})

    // ok
    const integer = { or: [
        '0',
        [[0x31, 0x39], digits1],
        ['-', { or: [
            '0',
            [[0x31, 0x39], digits1],
        ]}],
    ]} as const

    // ok
    const string = ['"', characters, '"']

    // ok
    const element = (): DataRule => [ws, value, ws]

    // ok
    const member2 = [ws, ':', element]

    // ok
    const members1 = [string, member2, (): DataRule => ({ or: [
        [],
        [',', members],
    ]})]

    // ok
    const members = [ws, members1]

    const object = ['{', ws, { or: [
        '}',
        [members1, '}'],
    ]}]

    const array = (): DataRule => ({ or: [
        ['[', ws, ']'],
        ['[', element, ']'],
    ]})

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

    const json: Rule = element
}
