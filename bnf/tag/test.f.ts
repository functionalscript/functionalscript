import { range } from '../../text/ascii/module.f.ts'
import { cp, str } from '../func/module.f.ts'
import { set, type Rule } from './module.f.ts'

/*
const none: Rule = () => ({
    '': []
})

const option = (v: Rule): Rule => () => ({
    none,
    some: v
})

const repeat0 = (v: Rule): Rule => {
    const f = () => ({
        none,
        some: [v, f]
    })
    return f
}

const _classic = () => {

    const json: Rule = () => ({
        element
    })

    const value: Rule = () => ({
        object,
        array,
        string,
        number,
        true: str('true'),
        false: str('false'),
        null: str('null'),
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

    const character: Rule = () => ({
        0: [[0x20, 0x21]],
        1: [[0x23, 0x5B]],
        2: [[0x5D, 0x10FFFF]],
        escape: [cp('\\'), escape],
    })

    const characters: Rule = repeat0(character)

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
}

const _deterministic = () => {

    const json: Rule = () => ({
        element
    })

    const value: Rule = () => ({
        object,
        array,
        string,
        number,
        true: str('true'),
        false: str('false'),
        null: str('null'),
    })

    const object: Rule = () => [cp('{'), () => ({
        ws,
        members,
    }), cp('}')]

    const members: Rule = () => [member, () => ({
        none,
        members: [cp(','), members],
    })]

    const member: Rule = () =>
        [ws, string, ws, cp(':'), element]

    const array: Rule = () => [cp('['), ws, array2, cp(']')]

    const array2: Rule = () => ({
        none,
        elements: [element1, elementsTail],
    })

    const elements: Rule = () => [ws, element1, elementsTail]

    const elementsTail: Rule = () => ({
        none,
        elements: [cp(','), elements],
    })

    const element: Rule = () =>
        [ws, element1]

    const element1: Rule = () => [value, ws]

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

    const integer: Rule = () => [numberSign, unsignedInteger]

    const unsignedInteger: Rule = () => ({
        ...set('0'),
        onenine: [onenine, digits0],
    })

    const digits0 = () => ({
        none,
        digits,
    })

    const numberSign: Rule = () => ({
        none,
        ...set('-'),
    })

    const digits: Rule = () => [digit, digits0]

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
        e: [() => set('Ee'), sign, digits],
    })

    const sign: Rule = () => ({
        none,
        ...set('+-'),
    })

    const ws: Rule = () => ({
        none,
        cp: [() => set(' \n\r\t'), ws],
    })
}
*/
