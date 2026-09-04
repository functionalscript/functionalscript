/**
 * @import { Rule } from '../../types.ts'
 */

import { range, remove, repeatFrom0, unicodeMax, set, times, option } from "../../module.f.mjs";

const onenine = range('19')

const digit = range('09')

const hex = {
    digit,
    AF: range('AF'),
    af: range('af'),
}

/** @type {Rule} */
export const string = [
    '"',
    repeatFrom0({
        c: remove(range(` ${unicodeMax}`), set('"\\')),
        escape: [
            '\\',
            {
                c: set('"\\/bfnrt'),
                u: ['u', times(4)(hex)],
            }
        ],
    }),
    '"'
]

const digits0 = repeatFrom0(digit)

const digits = /**@type{const}*/([digit, digits0])

export const optionNeg = option('-')

export const uint = /**@type {const}*/({
    0: '0',
    onenine: [onenine, digits0],
})

export const optionFloatSuffix = /**@type {const}*/([
    option(['.', digits]),
    option([set('Ee'), option(set('+-')), digits])
])

const number = [
    optionNeg,
    uint,
    ...optionFloatSuffix
]

export const wsSymbol = set(' \n\r\t')

export const ws = repeatFrom0(wsSymbol)

// export const cj = commaJoin0Plus(ws)

// /** @type {(v: Rule) => Sequence} */
// export const array = v => cj('[]', v)

// /** @type {(property: Rule, v: Rule) => Sequence} */
// export const object = (p, v) => cj('{}', [p, ws, ':', ws, v])

// /** @type {(property: Rule, v: Rule) => Variant} */
// export const createValue = (p, v) => ({
//     array: array(v),
//     object: object(p, v),
//     string,
//     number,
//     true: 'true',
//     false: 'false',
//     null: 'null',
// })

// const value = () => createValue(string, value)

// export const json = /**@type {const}*/([ws, value, ws])
