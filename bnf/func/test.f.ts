import {
    //firstSet,
    setOp,
    type TerminalRange,
    //type DataRule,
    type Rule,
    type Sequence,
    type Or,
    toTerminalRangeSequence,
    //type LazyRule
} from './module.f.ts'
import * as j from '../../json/module.f.ts'
import { sort } from '../../types/object/module.f.ts'
import { one } from "../../types/range/module.f.ts";

const stringify = j.stringify(sort)

const eq = (a: Rule, e: string) => () => {
    //const r = stringify(firstSet(a))
    //if (r !== e) { throw [r, e] }
}

const s = toTerminalRangeSequence

const c = (a: string) => one(a.codePointAt(0) as number)

// https://www.json.org/json-en.html

const classic = () => {
    // {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
    const ws: Rule = () => [
        [],
        [c('\t'), ws], // 9
        [c('\n'), ws], // 10
        [c('\r'), ws], // 13
        [c(' '), ws],  // 32
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
        '/',                         //  47
        '\\',                        //  92
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
        'true',  // 116
        'false', // 102
        'null',  // 110
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}
    const json: Rule = () => [
        [element]
    ]

    return {
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
        element: eq(
            element,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        elements: eq(
            elements,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        json: eq(
            json,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        hex: eq(hex, '{"empty":false,"map":[[false,47],[true,57],[false,64],[true,70],[false,96],[true,102]]}'),
        escape: eq(escape, '{"empty":false,"map":[[false,33],[true,34],[false,46],[true,47],[false,91],[true,92],[false,97],[true,98],[false,101],[true,102],[false,109],[true,110],[false,113],[true,114],[false,115],[true,117]]}'),
        character: eq(character, '{"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}'),
        characters: eq(characters, '{"empty":true,"map":[[false,31],[true,33],[false,34],[true,1114111]]}'),
    }
}

const deterministic = () => {
    // {"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}
    const ws: Rule = () => [
        [],
        [c('\t'), ws], // 9
        [c('\n'), ws], // 10
        [c('\r'), ws], // 13
        [c(' '), ws],  // 32
    ]

    // {"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}
    const sign: Rule = () => [
        [],
        '+', // 43
        '-', // 45
    ]

    // {"empty":false,"map":[[false,48],[true,57]]}
    const onenine: Rule = () =>[
        [[0x31, 0x39]]
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const digit: Rule = () => [
        '0',
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
        [c('E'), sign, digits], // 69
        [c('e'), sign, digits], // 101
    ]

    // {"empty":true,"map":[[false,45],[true,46]]}
    const fraction: Rule = () => [
        [],
        [c('.'), digits] // 46
    ]

    // {"empty":false,"map":[[false,47],[true,57]]}
    const integer1: Rule = () => [
        '0',                // 48
        [onenine, digits1], // 49-57
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const integer: Rule = () => [
        [integer1],        // 48-57
        [c('-'), integer1], // 45
    ]

    // {"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}
    const number: Rule = () => [
        [integer, fraction, exponent]
    ]

    // {"empty":false,"map":[[false,47],[true,57],[false,64],[true,70],[false,96],[true,102]]}
    const hex: Rule = () => [
        [digit],        // 48-57
        [[0x41, 0x46]], // A..F
        [[0x61, 0x66]], // a..f
    ]

    // {"empty":false,"map":[[false,33],[true,34],[false,46],[true,47],[false,91],[true,92],[false,97],[true,98],[false,101],[true,102],[false,109],[true,110],[false,113],[true,114],[false,115],[true,117]]}
    const escape: Rule = () => [
        '"',                         //  34
        '/',                         //  47
        '\\',                        //  92
        'b',                         //  98
        'f',                         // 102
        'n',                         // 110
        'r',                         // 114
        't',                         // 116
        [c('u'), hex, hex, hex, hex] // 117
    ]

    // {"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}
    const character: Rule = () => [
        [[0x20, 0x21]],     // exclude '"' 0x22
        [[0x23, 0x5B]],     // exclude '\' 0x5C
        [[0x5D ,0x10FFFF]], // 93-1114111
        [c('\\'), escape],  // 92
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
        [c(','), elements] // 44
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
        ']',                 // 93
        [elements1, c(']')],
    ]

    // {"empty":false,"map":[[false,90],[true,91]]}
    const array: Rule = () => [
        [c('['), ws, array1]
    ]

    // {"empty":false,"map":[[false,33],[true,34]]}
    const member1: Rule = () => [
        [string, ws, c(':'), element]
    ]

    // {"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}
    const member: Rule = () => [
        [ws, member1]
    ]

    // {"empty":true,"map":[[false,43],[true,44]]}
    const members2: Rule = () => [
        [],
        [c(','), members], // 44
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
        '}',           // 125
        [members1, c('}')],
    ]

    // {"empty":false,"map":[[false,122],[true,123]]}
    const object: Rule = () => [
        [c('{'), ws, object1]
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
    const json = element

    return {
        ws: eq(ws, '{"empty":true,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32]]}'),
        sign: eq(sign, '{"empty":true,"map":[[false,42],[true,43],[false,44],[true,45]]}'),
        digits1: eq(digits1, '{"empty":true,"map":[[false,47],[true,57]]}'),
        digits: eq(digits, '{"empty":false,"map":[[false,47],[true,57]]}'),
        exponent: eq(exponent, '{"empty":true,"map":[[false,68],[true,69],[false,100],[true,101]]}'),
        fraction: eq(fraction, '{"empty":true,"map":[[false,45],[true,46]]}'),
        onenine: eq(onenine, '{"empty":false,"map":[[false,48],[true,57]]}'),
        digit: eq(digit, '{"empty":false,"map":[[false,47],[true,57]]}'),
        string: eq(string, '{"empty":false,"map":[[false,33],[true,34]]}'),
        member1: eq(member1, '{"empty":false,"map":[[false,33],[true,34]]}'),
        member: eq(member, '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}'),
        members2: eq(members2, '{"empty":true,"map":[[false,43],[true,44]]}'),
        members1: eq(members1, '{"empty":false,"map":[[false,33],[true,34]]}'),
        members: eq(members, '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34]]}'),
        object1: eq(object1, '{"empty":false,"map":[[false,33],[true,34],[false,124],[true,125]]}'),
        object: eq(object, '{"empty":false,"map":[[false,122],[true,123]]}'),
        array1: eq(
            array1,
            '{"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,92],[true,93],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        array: eq(array, '{"empty":false,"map":[[false,90],[true,91]]}'),
        integer1: eq(integer1, '{"empty":false,"map":[[false,47],[true,57]]}'),
        integer: eq(integer, '{"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}'),
        number: eq(number, '{"empty":false,"map":[[false,44],[true,45],[false,47],[true,57]]}'),
        value: eq(value, '{"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        element1: eq(
            element1,
            '{"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        element: eq(
            element,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        elements2: eq(elements2, '{"empty":true,"map":[[false,43],[true,44]]}'),
        elements1: eq(
            elements1,
            '{"empty":false,"map":[[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        elements: eq(
            elements,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        json: eq(
            json,
            '{"empty":false,"map":[[false,8],[true,10],[false,12],[true,13],[false,31],[true,32],[false,33],[true,34],[false,44],[true,45],[false,47],[true,57],[false,90],[true,91],[false,101],[true,102],[false,109],[true,110],[false,115],[true,116],[false,122],[true,123]]}'),
        hex: eq(hex, '{"empty":false,"map":[[false,47],[true,57],[false,64],[true,70],[false,96],[true,102]]}'),
        escape: eq(escape, '{"empty":false,"map":[[false,33],[true,34],[false,46],[true,47],[false,91],[true,92],[false,97],[true,98],[false,101],[true,102],[false,109],[true,110],[false,113],[true,114],[false,115],[true,117]]}'),
        character: eq(character, '{"empty":false,"map":[[false,31],[true,33],[false,34],[true,1114111]]}'),
        characters: eq(characters, '{"empty":true,"map":[[false,31],[true,33],[false,34],[true,1114111]]}'),
    }
}

//

export default {
    example: {
        module: () => {
            // Matches 'A-Z', 'a-z', and '0-9'
            const grammar: Rule = () => [
                [[65, 90]],
                [[97, 122]],
                [[48, 57]],
            ]
            /*
            const s = firstSet(grammar)
            if (s.empty) { throw s }
            if (setOp.get('0'.codePointAt(0) as number)(s.map) !== true) { throw s }
            if (setOp.get('h'.codePointAt(0) as number)(s.map) !== true) { throw s }
            if (setOp.get('$'.codePointAt(0) as number)(s.map) !== false) { throw s }
            */
        },
        types: () => {
            const alpha: TerminalRange = [65, 90] // Matches 'A-Z'
            const id2: Sequence = [alpha, alpha]  // Matches two uppercase letters
            const digit: TerminalRange = [48, 57] // Matches '0-9'
            // Matches two uppercase letters or one digit
            const id2OrDigit: Or = [
                id2,
                [digit],
            ]
            // Matches 'true', 'false'
            const bool: Rule = () => [
               'true',
               'false',
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
    classic,
    deterministic,
}
