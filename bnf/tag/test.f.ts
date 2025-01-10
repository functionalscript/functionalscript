import { todo } from '../../dev/module.f.ts'
import { range } from '../../text/ascii/module.f.ts'
import { cp, str } from '../func/module.f.ts'
import { set, type Rule } from './module.f.ts'

const _classic = () => {

    const json: Rule = () => ({
        element
    })

    const value: Rule = () => ({
        object,
        array,
        string,
        number,
        true: 1,
        false: 1,
        null: 1,
    })

    const object: Rule = () => ({
        ws: [cp('{'), ws, cp('}')],
        members: [cp('{'), members, cp('}')],
    })

    const members: Rule = () => ({
        member,
        members: [member, cp(','), members],
    })

    const member: Rule = () =>
        [ws, string, ws, cp(':'), element]

    const array: Rule = () => ({
        ws: [cp('['), ws, cp(']')],
        elements: [cp('['), elements, cp(']')]
    })

    const elements: Rule = () => ({
        element,
        elements: [element, cp(','), elements],
    })

    const element: Rule = () =>
        [ws, value, ws]

    const string: Rule = () =>
        [cp('"'), characters, cp('"')]

    const characters: Rule = () => ({
        none,
        characters: [character, characters],
    })

    const character: Rule = () => ({
        0: [[0x20, 0x21]],
        1: [[0x23, 0x5B]],
        2: [[0x5D, 0x10FFFF]],
        escape: [cp('\\'), escape],
    })

    const escape: Rule = () => ({
        ...set('"\\/bfnrt'),
        u: [cp('u'), hex, hex, hex, hex],
    })

    const hex: Rule = () => ({
        digit,
        AF: [range('AF')],
        af: [range('af')],
    })

    const number: Rule = () => [integer, fraction, exponent]

    const integer: Rule = () => ({
        digit,
        digits: [onenine, digits],
        negDigit: [cp('-'), digit],
        negDigits: [cp('-'), digits],
    })

    const digits: Rule = () => ({
        digit,
        digits: [digit, digits]
    })

    const digit: Rule = () => ({
        ...set('0'),
        onenine,
    })

    const onenine: Rule = () => [range('19')]

    const fraction: Rule = () => ({
        none,
        digits: [cp('.'), digits]
    })

    const exponent: Rule = () => ({
        none,
        E: [cp('E'), sign, digits],
        e: [cp('e'), sign, digits],
    })

    const sign: Rule = () => ({
        none,
        ...set('+-'),
    })

    const ws: Rule = () => ({
        none,
        ' ': [cp(' '), ws],
        '\n': [cp('\n'), ws],
        '\r': [cp('\r'), ws],
        '\t': [cp('\t'), ws],
    })

    const none: Rule = () => ({
        '': []
    })
}
