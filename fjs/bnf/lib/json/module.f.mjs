/**
 * JSON grammar building blocks.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 */

import { commaJoin0Plus, option, range, remove, repeat, repeat0Plus, set, unicodeMax } from "../../module.f.mjs"

const onenine = range('19')

export const digit = range('09')

export const string = [
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

export const cj = commaJoin0Plus(ws)

/** @type {(v: Rule) => Rule} */
export const array = v => cj('[]', v)

/** @type {(property: Rule, v: Rule) => Rule} */
export const object = (p, v) => cj('{}', [p, ws, ':', ws, v])

export const createValue = (/**@type {Rule}*/p, /**@type {Rule}*/v) => ({
    array: array(v),
    object: object(p, v),
    string,
    number,
    true: 'true',
    false: 'false',
    null: 'null',
})

const value = () => createValue(string, value)

export const json = [ws, value, ws]
