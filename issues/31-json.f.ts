type TerminalRange = readonly[number, number]

type SetItem = TerminalRange|number|null

type Set = readonly SetItem[]

// JSON: https://www.json.org/json-en.html
{
    type Sequence = readonly Rule[]
    type Or = { readonly or: Sequence }

    type DataRule = Sequence|Or|TerminalRange|string

    //
    type LazyRule = () => DataRule
    type Rule = DataRule|LazyRule

    const ws = () => ({ or: [
        [],
        ['\t', ws], // 0x09
        ['\n', ws], // 0x0A
        ['\r', ws], // 0x0D
        [' ', ws],  // 0x20
    ]})

    const wsSet: Set = [null, [0x09, 0x0A], 0x0D, 0x20]

    const sign = { or: [
        [],
        '+', // 0x2B
        '-', // 0x2D
    ]}

    const signSet: Set = [null, 0x2B, 0x2D]

    const digits = () => [digit, ({ or: [
        [],
        digits
    ]})]

    const digitsSet: Set = [[0x30, 0x31]]

    const exponent = { or: [
        [],
        ['E', sign, digits],
        ['e', sign, digits],
    ]}

    const exponentSet: Set = [null, 0x45, 0x65]

    const fraction = { or: [
        [],
        ['.', digits]
    ]}

    const fractionSet: Set = [null, 0x2E]

    const onenine = [0x31, 0x39] as const

    const onenineSet: Set = [[0x31, 0x39]]

    const digit = { or: [
        '0',
        onenine,
    ]}

    const digitSet: Set = [[0x30, 0x31]]

    //

    const members1 = (): DataRule => [member1, ({ or: [
        [],
        [',', members],
    ]})]

    const members1Set: Set = [0x22] // '"'

    const members = [ws, members1]

    const membersSet: Set = [[0x09, 0x0A], 0x0D, 0x20, 0x22]

    const object = ['{', { or: [
        [ws, '}'],
        [members, '}'],
    ]}]

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

    const member1 = [string, ws, ':', element]

    const member1Set: Set = [0x22] // '"'

    // const member = [ws, member1]

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
