import {
    type TerminalRange,
    type Rule,
    type Sequence,
    type Or,
    cp,
    str,
    range,
    remove,
} from './module.f.ts'

const deterministic = () => {
    // {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
    const ws: Rule = () => [
        [],
        [cp('\t'), ws], // 9
        [cp('\n'), ws], // 10
        [cp('\r'), ws], // 13
        [cp(' '), ws],  // 32
    ]

    // {"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}
    const sign: Rule = () => [
        [],
        str('+'), // 43
        str('-'), // 45
    ]

    // {"empty":false,"map":[[false,48],[true,57]]}
    const onenine: Rule = () =>[
        [range('19')]
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digit: Rule = () => [
        str('0'),
        [onenine],
    ]

    // {"empty":true,"map":[[false,47],[true,57]]}
    const digits1: Rule = () => [
        [],
        [digit, digits1]
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digits: Rule = () => [
        [digit, digits1]
    ]

    // {"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}
    const exponent: Rule = () => [
        [],
        [cp('E'), sign, digits], // 69
        [cp('e'), sign, digits], // 101
    ]

    // {"empty":true,"map":[[false,45],[true,46]]}
    const fraction: Rule = () => [
        [],
        [cp('.'), digits] // 46
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const integer1: Rule = () => [
        str('0'),           // 48
        [onenine, digits1], // 49-57
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const integer: Rule = () => [
        [integer1],          // 48-57
        [cp('-'), integer1], // 45
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const number: Rule = () => [
        [integer, fraction, exponent]
    ]

    // {"empty":false,"map":[[false,47],[true,57],[false,64],[true,70],[false,96],[true,102]]}
    const hex: Rule = () => [
        [digit],       // 48-57
        [range('AF')], // A..F
        [range('af')], // a..f
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,46],[true,47],[false,91],[true,92],[false,97],[true,98],[false,101],[true,102],[false,109],[true,110],[false,113],[true,114],[false,115],[true,117]]}
    const escape: Rule = () => [
        str('"'),                     //  34
        str('/'),                     //  47
        str('\\'),                    //  92
        str('b'),                     //  98
        str('f'),                     // 102
        str('n'),                     // 110
        str('r'),                     // 114
        str('t'),                     // 116
        [cp('u'), hex, hex, hex, hex] // 117
    ]

    // {"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const character: Rule = () => [
        ...remove([0x20, 0x10FFFF], [cp('"'), cp('\\')]),
        [cp('\\'), escape], // 92
    ]

    // {"empty":true,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const characters: Rule = () => [
        [],
        [character, characters]
    ]

    // {"empty":false,"map":[[false,33],[true,34]]}
    const string: Rule = () => [
        [cp('"'), characters, cp('"')]
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const element1: Rule = () => [
        [value, ws]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const element: Rule = () => [
        [ws, element1]
    ]

    // {"empty":true,"map":[[false,43],[true,44]]}
    const elements2: Rule = () => [
        [],
        [cp(','), elements] // 44
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const elements1: Rule = () => [
        [element1, elements2]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const elements: Rule = () => [
        [ws, elements1]
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,92],[true,93],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const array1: Rule = () => [
        str(']'),             // 93
        [elements1, cp(']')],
    ]

    // {"empty":false,"map":[[false,90],[true,91]]}
    const array: Rule = () => [
        [cp('['), ws, array1]
    ]

    // {"empty":false,"map":[[false,33],[true,34]]}
    const member1: Rule = () => [
        [string, ws, cp(':'), element]
    ]

    // {"empty":true,"map":[[false,43],[true,44]]}
    const members2: Rule = () => [
        [],
        [cp(','), members], // 44
    ]

    // {"empty":false,"map":[[false,33],[true,34]]}
    const members1: Rule = () => [
        [member1, members2]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
    const members: Rule = () => [
        [ws, members1]
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,124],[true,125]]}
    const object1: Rule = () => [
        str('}'),            // 125
        [members1, cp('}')],
    ]

    // {"empty":false,"map":[[false,122],[true,123]]}
    const object: Rule = () => [
        [cp('{'), ws, object1]
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const value: Rule = () => [
        [object],     // 123
        [array],      // 91
        [string],     // 34
        [number],     // 45, 48-57
        str('true'),  // 116
        str('false'), // 102
        str('null'),  // 110
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const json = element

    const _ = json
}

//

export default {
    example: {
        module: () => {
            // Matches 'A-Z', 'a-z', and '0-9'
            const grammar: Rule = () => [
                [range('AZ')],
                [range('az')],
                [range('09')],
            ]
            const _ = grammar
        },
        types: () => {
            const alpha: TerminalRange = range('AZ') // Matches 'A-Z'
            const id2: Sequence = [alpha, alpha]     // Matches two uppercase letters
            const digit: TerminalRange = range('09') // Matches '0-9'
            // Matches two uppercase letters or one digit
            const id2OrDigit: Or = [
                id2,
                [digit],
            ]
            // Matches 'true', 'false'
            const bool: Rule = () => [
               str('true'),
               str('false'),
            ]
            // zero or more alpha symbols
            const alpha0x: Rule = () => [
                [],              // Empty
                [alpha, alpha0x] // Recursive
            ]
            const id: Sequence = [alpha, alpha0x]

            const _ = [id2OrDigit, bool, id]
        }
    },
    remove: () => {
        const _x = remove([0x20, 0x10FFFF], [cp('"'), cp('\\')])
    }
}
