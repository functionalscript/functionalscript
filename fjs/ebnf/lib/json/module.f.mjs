/**
 * The JSON grammar, written with the EBNF front end.
 *
 * @module
 *
 * @import { Const, Rule, Set, Tuple, Variant } from '../../types.ts'
 */

import { range, remove, repeatFrom0, unicodeMax, set, times, option, join } from "../../module.f.mjs"

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

export const cj =
    /**
     * @param {string} s
     * @param {Rule} item
     */
    ([open, close], item) =>
    /**@type {const}*/([open, ws, join([',', ws])([item, ws]), close])

/** @type {(v: Rule) => Tuple} */
export const array = v => cj('[]', v)

/** @type {(property: Rule, v: Rule) => Tuple} */
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

/**
 * A value contains values, so the rule has to name itself, and a thunk is how
 * a name is spelled here. `const` is the tag that says the thunk yields a data
 * rule, which is what tells a consumer apart from a set or a repetition.
 *
 * @type {Const<Variant>}
 */
const value = () => ['const', createValue(string, value)]

export const json = /**@type {const}*/([ws, value, ws])
