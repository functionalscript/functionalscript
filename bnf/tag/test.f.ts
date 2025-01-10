import { join0, none, option, range, repeat0, repeat1, type Rule, set } from './module.f.ts'

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
        0: 0x20_000021n,
        1: 0x23_00005Bn,
        2: 0x5D_10FFFFn,
        escape: ['\\', escape],
    })

    const escape = () => ({
        ...set('"\\/bfnrt'),
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

    const onenine = range('12')

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
        ...set('+-'),
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

    const onenine = range('12')

    const digit: Rule = {
        '0': '0',
        onenine,
    }

    const hex = {
        digit,
        AF: range('AF'),
        af: range('af'),
    }

    const escape = {
        ...set('"\\/bfnrt'),
        u: ['u', hex, hex, hex, hex],
    }

    const character: Rule = {
        0: 0x20_000021n,
        1: 0x23_00005Bn,
        2: 0x5D_10FFFFn,
        escape: ['\\', escape],
    }

    const characters = repeat0(character)

    const string = ['"', characters, '"']

    const digits0 = repeat0(digit)

    const digits = [digit, digits0]

    const integer = [option('-'), {
        '0': '0',
        onenine: [onenine, digits0],
    }]

    const fraction = option(['.', digits])

    const sign = option(set('+-'))

    const exponent = option([set('Ee'), sign, digits])

    const number = [integer, fraction, exponent]

    const ws = repeat0(set(' \n\r\t'))

    const element = [value, ws]

    const elements = join0(element, [',', ws])

    const array = ['[', ws, elements, ']']

    const member = [ws, string, ws, ':', ws, element]

    const json = [ws, element]

    return json
}
