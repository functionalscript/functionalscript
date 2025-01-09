import { stringify } from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import {
    type TerminalRange,
    type Rule,
    type Sequence,
    type Or,
    cp,
    str,
    range,
    remove,
    set,
    repeat0,
    join0,
} from './module.f.ts'

const deterministic = () => {
    const wsSet: Rule = () => set('\t\n\r ') // 9,10,13,32

    // {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
    const ws: Rule = repeat0(wsSet)

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
    const digits0: Rule = repeat0(digit)

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digits1: Rule = () => [
        [digit, digits0]
    ]

    // {"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}
    const exponent: Rule = () => [
        [],
        [cp('E'), sign, digits1], // 69
        [cp('e'), sign, digits1], // 101
    ]

    // {"empty":true,"map":[[false,45],[true,46]]}
    const fraction: Rule = () => [
        [],
        [cp('.'), digits1] // 46
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const unsignedInteger: Rule = () => [
        str('0'),           // 48
        [onenine, digits0], // 49-57
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const integer: Rule = () => [
        [unsignedInteger],          // 48-57
        [cp('-'), unsignedInteger], // 45
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
        ...set('"\\/bfnrt'),
        [cp('u'), hex, hex, hex, hex] // 117
    ]

    // {"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const character: Rule = () => [
        ...remove([0x20, 0x10FFFF], [cp('"'), cp('\\')]),
        [cp('\\'), escape], // 92
    ]

    // {"empty":true,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const characters: Rule = repeat0(character)

    // {"empty":false,"map":[[false,33],[true,34]]}
    const string: Rule = () => [
        [cp('"'), characters, cp('"')]
    ]

    const comma: Rule = () => [[cp(','), ws]]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const element: Rule = () => [
        [value, ws]
    ]

    const list = (open: string, rule: Rule, close: string) => () => [
        [cp(open), ws, join0(rule, comma), cp(close)]
    ]

    // {"empty":false,"map":[[false,90],[true,91]]}
    const array: Rule = list('[', element, ']')

    // {"empty":false,"map":[[false,33],[true,34]]}
    const member: Rule = () => [
        [string, ws, cp(':'), ws, element]
    ]

    // {"empty":false,"map":[[false,122],[true,123]]}
    const object: Rule = list('{', member, '}')

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
    const json = [ws, element]

    const _ = json
}

//

const s = stringify(sort)

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
        },
        str: () => {
            const ranges = str('abc') // [[97, 97], [98, 98], [99, 99]]
            const result = s(ranges)
            if (result !== '[[97,97],[98,98],[99,99]]') { throw result }
        },
        cp: () => {
            const range = cp('A'); // [65, 65]
            const result = s(range)
            if (result !== '[65,65]') { throw result }
        },
        range: () => {
            const r = range('AZ'); // [65, 90]
            const result = s(r)
            if (result !== '[65,90]') { throw result }
        },
        remove: () => {
            const result = s(remove([65, 90], [cp('C'), cp('W')])) // [A..Z] w/o C and W
            if (result !== '[[[65,66]],[[68,86]],[[88,90]]]') { throw result }
        }
    },
    remove: () => {
        const _x = remove([0x20, 0x10FFFF], [cp('"'), cp('\\')])
    }
}
