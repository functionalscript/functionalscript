/**
 * The JSON grammar, written with the EBNF front end.
 *
 * @module
 *
 * @import { Const, Rule, Tuple, Variant } from '../../types.ts'
 * @import { Ast, Children, Meta } from '../../ast/types.ts'
 * @import { Mapping } from '../../ll1/types.ts'
 */

import { assert, todo } from "../../../asserts/module.f.mjs"
import { isFixedArray } from "../../../types/array/module.f.mjs"
import { mapping } from "../../ll1/module.f.mjs"
import { range, remove, repeatFrom0, unicodeMax, set, times, option, join } from "../../module.f.mjs"

const isFixedArray2 =
    isFixedArray(2)

const onenine = range('19')

export const digit = range('09')

const hex = {
    digit,
    AF: range('AF'),
    af: range('af'),
}

const hex4 = times(4)(hex)

const u = /** @type {const} */(['u', hex4])

const c = set('"\\/bfnrt')

/** @type {Rule} */
export const string = [
    '"',
    repeatFrom0({
        c: remove(range(` ${unicodeMax}`), set('"\\')),
        escape: ['\\', { c, u }],
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

/**
 * A comma-separated list of `item`s inside a pair of delimiters, with
 * whitespace allowed at every position one may appear.
 *
 * The two delimiters arrive as one two-symbol string, the way `range` takes
 * its endpoints, so a call site cannot pair an opening delimiter with a
 * closing one it never wrote. Spreading a string yields code points, so an
 * astral delimiter is one symbol here.
 *
 * @throws If `oc` does not contain exactly two unicode code points.
 *
 * @type {(oc: string, item: Rule) => Tuple}
 */
export const cj = (oc, item) => {
    const p = [...oc]
    assert(isFixedArray2(p))
    const [open, close] = p
    return [open, ws, join([',', ws])([item, ws]), close]
}

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

/** @type {(json: unknown) => Meta<_Meta>} */
const meta = json => ({ symbol: 0, meta: { json } })

/** @type {(s: string) => number} */
const cp = s => {
    assert(s.length === 1)
    const p = s.codePointAt(0)
    assert(p !== undefined)
    return p
}

const offset0 = cp('0')
const offsetA = cp('A') - 10
const offseta = cp('a') - 10

/** @typedef {{ readonly json: unknown }} _Meta */

/** @typedef {Mapping<'', _Meta>} _M */

/** @type {_M} */
const hexMap = mapping(hex, ([k, v]) => {
    switch (k) {
        case 'digit': return meta(v.symbol - offset0)
        case 'AF': return meta(v.symbol - offsetA)
        case 'af': return meta(v.symbol - offseta)
    }
})

/** @type {<R extends Rule>(a: Ast<R, '', _Meta>) => Meta<_Meta>} */
const out = a => {
    assert(typeof a === 'object' && !(a instanceof Array))
    assert(typeof a.meta !== 'string')
    return a
}

/** @type {_M} */
const hex4Map = mapping(hex4, a => meta(a.reduce((r, h) => {
    const h0 = out(h).meta.json
    assert(typeof h0 === 'number')
    return (r << 4) | h0
}, 0)))

/** @type {_M} */
const uMap = mapping(u, ([, h4]) => {
    const h40 = out(h4).meta.json
    assert(typeof h40 === 'number')
    return meta(String.fromCodePoint(h40))
})

/** @type {_M} */
const cMap = mapping(c, x => {
    x.symbol
    return todo()
})
