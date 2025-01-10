import { range } from '../../text/ascii/module.f.ts'
import { join } from '../../types/string/module.f.ts'
import { cp, str } from '../func/module.f.ts'
import { join0, none, option, repeat0, repeat1, Sequence, set, type Rule } from './module.f.ts'

const _classic = (): Rule => {

    const json = () => [element]

    const value = () => ({
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
        members: [member, cp(','), members],
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

    const element = () => [ws, value, ws]

    const string = () => [cp('"'), characters, cp('"')]

    const characters = () => ({
        none,
        characters: [character, characters],
    })

    const character = () => ({
        0: [[0x20, 0x21]],
        1: [[0x23, 0x5B]],
        2: [[0x5D, 0x10FFFF]],
        escape: [cp('\\'), escape],
    })

    const escape = () => ({
        ...set('"\\/bfnrt'),
        u: [cp('u'), hex, hex, hex, hex],
    })

    const hex = () => ({
        digit,
        AF: range('AF'),
        af: range('af'),
    })

    const number = () => [integer, fraction, exponent]

    const integer = () => ({
        digit,
        onenine: [onenine, digits],
        negDigit: [cp('-'), digit],
        negOnenine: [cp('-'), onenine, digits],
    })

    const digits = () => ({
        digit,
        digits: [digit, digits],
    })

    const digit: Rule = () => ({
        '0': str('0'),
        onenine,
    })

    const onenine = () => [range('12')]

    //

    const fraction = () => ({
        none,
        digits: [cp('.'), digits],
    })

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

const _deterministic = (): Rule => {
    const json = () => [ws, element]

    const value = () => ({
        object,
        array,
        string,
        number,
        true: str('true'),
        false: str('false'),
        null: str('null')
    })

    const object = () => [cp('{'), ws, members, cp('}')]

    const members = () => join0(member, () => [cp(','), ws])

    const member = (): Sequence => [string, ws, cp(':'), ws, element]

    const array = () => [cp('['), ws, elements, cp(']')]

    const elements = () => join0(element, () => [cp(','), ws])

    const element: Rule = () => [value, ws]

    const string = () => [cp('"'), () => option(character), cp('"')]

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

    const number = () => [integer, fraction, exponent]

    const unsigned = () => ({
        '0': str('0'),
        onenine: [onenine, digits],
    })

    const numberSign = () => option([cp('-')])

    const integer = () => [numberSign, unsigned]

    const digits = () => repeat1(digit)

    const digit: Rule = () => ({
        '0': str('0'),
        onenine,
    })

    const onenine = () => [range('12')]

    const fraction = () => option([cp('.'), digits])

    const exponent: Rule = () => option([() => set('Ee'), sign, digits])

    const sign = () => option(() => set('+-'))

    const ws = repeat0(() => set(' \n\r\t'))

    return json
}
