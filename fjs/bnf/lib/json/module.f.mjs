/**
 * JSON grammar building blocks.
 *
 * @module
 *
 * @import { Rule, Sequence, Variant } from '../../types.ts'
 */

import { commaJoin0Plus, option, range, remove, repeat, repeat0Plus, set, unicodeMax } from '../../module.f.mjs'

const onenine = range('19')

export const digit = range('09')

/** @type {Rule} */
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

/** @type {Rule} */
export const optionNeg = option('-')

export const uint = /**@type {const}*/({
    0: '0',
    onenine: [onenine, digits0],
})

/** @type {Sequence} */
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

/** @type {(v: Rule) => Sequence} */
export const array = v => cj('[]', v)

/** @type {(property: Rule, v: Rule) => Sequence} */
export const object = (p, v) => cj('{}', [p, ws, ':', ws, v])

/** @type {(property: Rule, v: Rule) => Variant} */
export const createValue = (p, v) => ({
    array: array(v),
    object: object(p, v),
    string,
    number,
    true: 'true',
    false: 'false',
    null: 'null',
})

const value = () => createValue(string, value)

export const json = /**@type {const}*/([ws, value, ws])
