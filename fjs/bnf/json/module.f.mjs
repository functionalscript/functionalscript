import { commaJoin0Plus, option, range, remove, repeat, repeat0Plus, repeat1Plus, set, unicodeMax } from "../module.f.mjs"

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

export const uint = {
    0: '0',
    19: [onenine, digits0],
}

export const optionFloatSuffix = [
    option(['.', digits]),
    option([set('Ee'), option(set('+-')), digits])
]

export const optionNeg = option('-')

export const int = [optionNeg, uint]

const number = [int, optionFloatSuffix]

export const wsSymbol = set(' \n\r\t')

export const ws = repeat0Plus(wsSymbol)

export const cj = commaJoin0Plus(ws)

export const true_ = 'true'

export const false_ = 'false'

export const null_ = 'null'

const value = () => ({
    number,
    string,
    true_,
    false_,
    null_,
    array: cj('[]', value),
    object: cj('{}', [string, ws, ':', ws, value]),
})

const json = [ws, value, ws]
