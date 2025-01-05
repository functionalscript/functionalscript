import { one } from '../../types/range/module.f.ts'
import type { Rule } from './module.f.ts'

const c = (a: string) => one(a.codePointAt(0) as number)

// https://www.json.org/json-en.html

export const classic = () => {
    // {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
    const ws: Rule = () => [
        [],
        [c(' '), ws],  // 32
        [c('\n'), ws], // 10
        [c('\r'), ws], // 13
        [c('\t'), ws], // 9
    ]

    // {"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}
    const sign: Rule = () => [
        [],
        '+', // 43
        '-', // 45
    ]

    // {"empty":false,"map":[[false,48],[true,57]]}
    const onenine: Rule = () => [[[0x31, 0x39]]]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digit: Rule = () => [
        '0',
        [onenine],
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digits: Rule = () => [
        [digit],
        [digit, digits]
    ]

    // {"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}
    const exponent: Rule = () => [
        [],
        [c('E'), sign, digits], // 69
        [c('e'), sign, digits], // 101
    ]

    // {"empty":true,"map":[[false,45],[true,46]]}
    const fraction: Rule = () => [
        [],
        [c('.'), digits] // 46
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const integer: Rule = () => [
        [digit],                // 48-57
        [onenine, digits],
        [c('-'), digit],           // 45
        [c('-'), onenine, digits],
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const number: Rule = () => [
        [integer, fraction, exponent]
    ]

    // {"empty":false,"map":[[false,47],[true,57],[false,64],[true,70],[false,96],[true,102]]}
    const hex: Rule = () => [
        [digit],       // 48-57
        [[0x41, 0x46]], // A..F
        [[0x61, 0x66]], // a..f
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,46],[true,47],[false,91],[true,92],[false,97],[true,98],[false,101],[true,102],[false,109],[true,110],[false,113],[true,114],[false,115],[true,117]]}
    const escape: Rule = () => [
        '"',                         //  34
        '\\',                        //  92
        '/',                         //  47
        'b',                         //  98
        'f',                         // 102
        'n',                         // 110
        'r',                         // 114
        't',                         // 116
        [c('u'), hex, hex, hex, hex] // 117
    ]

    // {"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const character: Rule = () =>[
        [[0x20, 0x21]],     // exclude '"' 0x22
        [[0x23, 0x5B]],     // exclude '\' 0x5C
        [[0x5D ,0x10FFFF]], // 93-1114111
        [c('\\'), escape],   // 92
    ]

    // {"empty":true,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const characters: Rule = () => [
        [],
        [character, characters]
    ]

    // {"empty":false,"map":[[false,33],[true,34]]}
    const string: Rule = () => [
        [c('"'), characters, c('"')]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const element: Rule = () => [
        [ws, value, ws]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const elements: Rule = () => [
        [element],
        [element, c(','), elements]
    ]

    // {"empty":false,"map":[[false,90],[true,91]]}
    const array: Rule = () => [
        [c('['), ws, c(']')],      // 91
        [c('['), elements, c(']')],
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
    const member: Rule = () => [
        [ws, string, ws, c(':'), element]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
    const members: Rule = () => [
        [member],
        [member, c(','), members],
    ]

    // {"empty":false,"map":[[false,122],[true,123]]}
    const object: Rule = () => [
        [c('{'), ws, c('}')],      // 123
        [c('{'), members, c('}')],
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const value: Rule = () => [
        [object],  // 123
        [array],   // 91
        [string],  // 34
        [number],  // 45, 48-57
        'true',    // 116
        'false',   // 102
        'null',    // 110
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const json: Rule = () => [
        [element]
    ]

    return {
        ws,
        sign,
        digits,
        exponent,
        fraction,
        onenine,
        digit,
        string,
        member,
        members,
        object,
        array,
        integer,
        number,
        value,
        element,
        elements,
        json,
        hex,
        escape,
        character,
        characters,
    } as const
}
