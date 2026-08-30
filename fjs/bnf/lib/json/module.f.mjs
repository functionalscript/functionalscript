import { commaJoin0Plus, option, range, remove, repeat, repeat0Plus, set, unicodeMax } from "../../module.f.mjs"

const onenine = range('19')

export const digit = range('09')

const string = [
    '"',
    repeat0Plus({
        ...remove(range(` ${unicodeMax}`), set('"\\')),
        escape: [
            '\\',
            {
                ...set('"\\/bfnrt'),
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

export const optionNeg = option('-')

export const uint = {
    0: '0',
    onenine: [onenine, digits0],
}

export const optionFloatSuffix = [
    option(['.', digits]),
    option([set('Ee'), option(set('+-')), digits])
]

const number = [
    optionNeg,
    uint,
    ...optionFloatSuffix
]

export const wsSymbol = set(' \n\r\t')

export const ws = repeat0Plus(wsSymbol)

const cj = commaJoin0Plus(ws)

export const false_ = 'false'

export const true_ = 'true'

export const null_ = 'null'

const value = () => ({
    array: cj('[]', value),
    object: cj('{}', [string, ws, ':', ws, value]),
    string,
    number,
    true: true_,
    false: false_,
    null: null_,
})

export const json = [ws, value, ws]
