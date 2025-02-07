import { join0Plus, none, option, range, remove, repeat, repeat0Plus, type Rule, toSequence, max, set } from './module.f.ts'

const _classic = (): Rule => {

    const json = () => [element]

    const value = () => ({
        object,
        array,
        string,
        number,
        true: 'true',
        false: 'false',
        null: 'null'
    })

    const object = () => ({
        ws: ['{', ws, '}'],
        members: ['{', members, '}'],
    })

    const members = () => ({
        member,
        members: [member, ',', members],
    })

    const member = () => [ws, string, ws, ':', element]

    const array = () => ({
        ws: ['[', ws, ']'],
        elements: ['[', elements, ']'],
    })

    const elements = () => ({
        element,
        elements: [element, ',', elements],
    })

    const element = () => [ws, value, ws]

    const string = () => ['"', characters, '"']

    const characters = () => ({
        none,
        characters: [character, characters],
    })

    const character: Rule = () => ({
        0: 0x20_000021,
        1: 0x23_00005B,
        2: 0x5D_10FFFF,
        escape: ['\\', escape],
    })

    const escape = () => ({
        ...toSequence('"\\/bfnrt'),
        u: ['u', hex, hex, hex, hex],
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
        negDigit: ['-', digit],
        negOnenine: ['-', onenine, digits],
    })

    const digits = () => ({
        digit,
        digits: [digit, digits],
    })

    const digit: Rule = () => ({
        '0': '0',
        onenine,
    })

    const onenine = range('19')

    const fraction = () => ({
        none,
        digits: ['.', digits],
    })

    const exponent = () => ({
        none,
        E: ['E', sign, digits],
        e: ['e', sign, digits],
    })

    const sign = {
        none,
        ...toSequence('+-'),
    }

    const ws = () => ({
        none,
        ' ': [' ', ws],
        '\n': ['\n', ws],
        '\r': ['\r', ws],
        '\t': ['\t', ws],
    })

    return json
}

const _deterministic = (): Rule => {

    const onenine = range('19')

    const digit: Rule = range('09')

    const string = [
        '"',
        repeat0Plus({
            ...remove(range(` ${max}`), set('"\\')),
            escape: [
                '\\',
                {
                    ...toSequence('"\\/bfnrt'),
                    u: [
                        'u',
                        ...repeat(4)({
                            digit,
                            AF: range('AF'),
                            af: range('af'),
                        })
                    ],
                }
            ],
        }),
        '"'
    ]

    const digits0 = repeat0Plus(digit)

    const digits = [digit, digits0]

    const number = [
        option('-'),
        {
            0: '0',
            onenine: [onenine, digits0],
        },
        option(['.', digits]),
        option([toSequence('Ee'), option(toSequence('+-')), digits])
    ]

    const ws = repeat0Plus(toSequence(' \n\r\t'))

    const commaJoin0Plus = ([open, close]: string, a: Rule) => [
        open,
        ws,
        join0Plus([a, ws], [',', ws]),
        close,
    ]

    const value = () => ({
        object: commaJoin0Plus('{}', [string, ws, ':', ws, value]),
        array: commaJoin0Plus('[]', value),
        string,
        number,
        true: 'true',
        false: 'false',
        null: 'null'
    })

    const json = [ws, value, ws]

    return json
}

export default {
    test: () => {
        _classic()
        _deterministic()
    }
}
