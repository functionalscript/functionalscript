type TerminalRange = readonly[number, number]

// JSON: https://www.json.org/json-en.html
{
    type Sequence = readonly Rule[]
    type Or = { readonly or: Sequence }

    type DataRule = Sequence|Or|TerminalRange|string

    //
    type LazyRule = () => DataRule
    type Rule = DataRule|LazyRule

    // null, [0x09, 0x0A], 0x0D, 0x20
    const ws = () => ({ or: [
        [],
        ['\t', ws], // 0x09
        ['\n', ws], // 0x0A
        ['\r', ws], // 0x0D
        [' ', ws],  // 0x20
    ]})

    // null, 0x2B, 0x2D
    const sign = { or: [
        [],
        '+', // 0x2B
        '-', // 0x2D
    ]}

    // null, [0x30, 0x39]
    const digits1 = () => ({ or: [
        [],
        digits // [0x30, 0x39]
    ]})

    // [0x30, 0x39]
    const digits = () => [digit, digits1]

    // null, 0x45, 0x65
    const exponent = { or: [
        [],
        ['E', sign, digits], // 0x45
        ['e', sign, digits], // 0x65
    ]}

    // null, 0x2E
    const fraction = { or: [
        [],
        ['.', digits] // 0x2E
    ]}

    // [0x31, 0x39]
    const onenine = [0x31, 0x39] as const

    // [0x30, 0x39]
    const digit = { or: [
        '0',     // 0x30
        onenine, // [0x31, 0x39]
    ]}

    // null, 0x2C
    const members2 = (): DataRule => ({ or: [
        [],
        [',', ws, members1], // 0x2C
    ]})

    // 0x22
    const members1 = (): DataRule => [member1, members2]

    // 0x22, 0x7D
    const object1 = { or: [
        [members1, '}'], // 0x22
        '}',             // 0x7D
    ]}

    // 0x7B
    const object = ['{', ws, object1]

    // 0x22, 0x2D, [0x30, 0x39], 0x5B, 0x5D, 0x66, 0x6E, 0x74, 0x7B
    const array1 = (): DataRule => ({ or: [
        [element1, ']'], // 0x22, 0x2D, [0x30, 0x39], 0x5B, 0x66, 0x6E, 0x74, 0x7B
        ']',             // 0x5D
    ]})

    // 0x5B
    const array = ['[', ws, array1]

    // [0x30, 0x39], [0x41, 0x46], [0x61, 0x66]
    const hex = { or: [
        digit,        // [0x30, 0x39]
        [0x41, 0x46], // A..F
        [0x61, 0x66], // a..f
    ]} as const

    // 0x22, 0x2F, 0x5C, 0x62, 0x66, 0x6E, 0x72, [0x74, 0x75]
    const escape = { or: [
        '"',                      // 0x22
        '/',                      // 0x2F
        '\\',                     // 0x5C
        'b',                      // 0x62
        'f',                      // 0x66
        'n',                      // 0x6E
        'r',                      // 0x72
        't',                      // 0x74
        ['u', hex, hex, hex, hex] // 0x75
    ]}

    // [0x20, 0x21], [0x23, 0x10FFFF]
    const character: Rule = { or: [
        [0x20, 0x21],     // exclude '"' 0x22
        [0x23, 0x5B],     // exclude '\' 0x5C
        [0x5D ,0x10FFFF], //
        ['\\', escape],   // 0x5C
    ]} as const

    // null, [0x20, 0x21], [0x23, 0x10FFFF]
    const characters = () => ({ or: [
        [],
        [character, characters]
    ]})

    // 0x22
    const string = ['"', characters, '"']

    // [0x30, 0x39]
    const integer1 = { or: [
        '0',
        [onenine, digits1],
    ]}

    // 0x2D, [0x30, 0x39]
    const integer = { or: [
        ['-', integer1],    // 0x2D
        '0',                // 0x30
        [onenine, digits1], // [0x31, 0x39]
    ]}

    // 0x2D, [0x30, 0x39]
    const number = [integer, fraction, exponent]

    // 0x22, 0x2D, [0x30, 0x39], 0x5B, 0x66, 0x6E, 0x74, 0x7B
    const value = { or: [
        string,  // 0x22
        number,  // 0x2D, [0x30, 0x39]
        array,   // 0x5B
        'false', // 0x66
        'null',  // 0x6E
        'true',  // 0x74
        object,  // 0x7B
    ]}

    // 0x22, 0x2D, [0x30, 0x39], 0x5B, 0x66, 0x6E, 0x74, 0x7B
    const element1 = [value, ws]

    // [0x09, 0x0A], 0x0D, 0x20, 0x22, 0x2D, [0x30, 0x39], 0x5B, 0x66, 0x6E, 0x74, 0x7B
    const element = [ws, element1]

    // 0x22
    const member1 = [string, ws, ':', element]

    const json: Rule = element
}

// serializable
{
    type Sequence = readonly Rule[]
    type Or = { readonly or: Sequence }

    type DataRule = Sequence|Or|TerminalRange|string

    //
    type Id = keyof typeof map

    type LazyRule = { readonly id: Id }
    type Rule = DataRule|LazyRule

    type RuleMap = { readonly[k in Id]: Rule }

    //

    const element: LazyRule = { id: 'element' }
    const ws: LazyRule = { id: 'ws' }
    const value: LazyRule = { id: 'value' }
    const object: LazyRule = { id: 'object' }
    const array: LazyRule = { id: 'array' }
    const string: LazyRule = { id: 'string' }
    const number: LazyRule = { id: 'number' }
    const members: LazyRule = { id: 'members' }
    const characters: LazyRule = { id: 'characters' }
    const integer: LazyRule = { id: 'integer' }
    const fraction: LazyRule = { id: 'fraction' }
    const exponent: LazyRule = { id: 'exponent' }
    const member: LazyRule = { id: 'member' }
    const character: LazyRule = { id: 'character' }
    const digit: LazyRule = { id: 'digit' }
    const onenine: LazyRule = { id: 'onenine' }
    const digits: LazyRule = { id: 'digits' }
    const sign: LazyRule = { id: 'sign' }
    const escape: LazyRule = { id: 'escape' }
    const hex: LazyRule = { id: 'hex' }

    const map = {
        json: element,
        element: [ws, value, ws],
        ws: { or: [
            [],
            [' ', ws],
            ['\t', ws],
            ['\n', ws],
            ['\r', ws],
        ]},
        value: { or: [
            object,
            array,
            string,
            number,
            'true',
            'false',
            'null'
        ]},
        object: { or: [
            ['{', ws, '}'],
            ['{', members, '}'],
        ]},
        array: { or: [
            ['[', ws, ']'],
            ['[', element, ']'],
        ]},
        string: ['"', characters, '"'],
        number: [integer, fraction, exponent],
        members: { or: [
            member,
            [member, ',', members],
        ]},
        characters: { or: [
            [],
            [character, characters]
        ]},
        integer: { or: [
            digit,
            [onenine, digits],
            ['-', digit],
            ['-', onenine, digits],
        ]},
        fraction: { or: [
            [],
            ['.', digits]
        ]},
        exponent: { or: [
            [],
            ['E', sign, digits],
            ['e', sign, digits],
        ]},
        member: [ws, string, ws, ':', element],
        character: { or: [
            [0x20, 0x21], // exclude '"' 0x22
            [0x23, 0x5B], // exclude '\' 0x5C
            [0x5D ,0x10FFFF],
            ['\\', escape],
        ]},
        digit: { or: [
            '0',
            onenine,
        ]},
        onenine: [0x31, 0x39],
        digits: { or: [
            digit,
            [digit, digits]
        ]},
        sign: { or: [
            [],
            '+',
            '-',
        ]},
        escape: { or: [
            '"',
            '\\',
            '/',
            'b',
            'f',
            'n',
            'r',
            't',
            ['u', hex, hex, hex, hex]
        ]},
        hex: { or: [
            digit,
            [0x41, 0x46], // A..F
            [0x61, 0x66], // a..f
        ]},
    } as const

    const _map: RuleMap = map
}
