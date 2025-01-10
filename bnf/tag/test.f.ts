import { range } from '../../text/ascii/module.f.ts'
import { cp, str } from '../func/module.f.ts'
import { none, option, repeat0, repeat1, set, type Rule } from './module.f.ts'

const _classic = (): Rule => {

    const json: Rule = () => element()

    const value: Rule = () => ({
        object,
        array,
        string,
        number,
        true: str('true'),
        false: str('false'),
        null: str('null')
    })

    const object = () => ({
        ws: [cp('{'), ws, cp('}')],
        members: [cp('{'), members, cp('}')],
    })

    const members = () => ({
        member,
        members: [cp(','), members],
    })

    const member = () => [ws, string, ws, cp(':'), element]

    const array = () => ({
        ws: [cp('['), ws, cp(']')],
        elements: [cp('['), elements, cp(']')],
    })

    const elements = () => ({
        element,
        elements: [element, cp(','), elements],
    })

    const element: Rule = () => [ws, value, ws]

    const string = () => [cp('"'), characters, cp('"')]

    const characters = () => repeat0(character)

    const character: Rule = () => ({
        '0': [[0x20, 0x21]],
        '1': [[0x23, 0x5B]],
        '2': [[0x5D, 0x10FFFF]],
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
        onenine: [onenine, digits],
        negDigit: [cp('-'), digit],
        negOnenine: [cp('-'), onenine, digits],
    })

    const digits = () => repeat1(digit)

    const digit: Rule = () => ({
        '0': str('0'),
        onenine,
    })

    const onenine = () => [range('19')]

    const fraction = () => option([cp('.'), digits])

    const exponent = () => ({
        none,
        E: [cp('E'), sign, digits],
        e: [cp('e'), sign, digits],
    })

    const sign = () => ({
        none,
        ...set('+-'),
    })

    const ws = () => ({
        none,
        ' ': [cp(' '), ws],
        '\n': [cp('\n'), ws],
        '\r': [cp('\r'), ws],
        '\t': [cp('\t'), ws],
    })

    return json
}
