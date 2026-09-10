/**
 * The JSON grammar, written with the EBNF front end.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 * @import { Container, ContainerNode, Entry, JsonValue, Value } from './types.ts'
 */

import { assert } from "../../../asserts/module.f.mjs"
import { isFixedArray } from "../../../types/array/module.f.mjs"
import { unmapped } from "../../ast/module.f.mjs"
import { range, remove, repeatFrom0, unicodeMax, set, times, option, join, joined } from "../../module.f.mjs"

const isFixedArray2 =
    isFixedArray(2)

const onenine = range('19')

export const digit = range('09')

/** One hex digit of a `\u` escape, tagged by the range it is drawn from. */
export const hex = /**@type {const}*/({
    digit,
    AF: range('AF'),
    af: range('af'),
})

/**
 * An escape: the backslash, then the character of a simple escape, or `u`
 * and four hex digits.
 */
export const escape = /**@type {const}*/([
    '\\',
    {
        c: set('"\\/bfnrt'),
        u: ['u', times(4)(hex)],
    }
])

/** One character of a string: a symbol as it stands, or an escape. */
export const character = /**@type {const}*/({
    c: remove(range(` ${unicodeMax}`), set('"\\')),
    escape,
})

export const string = /**@type {const}*/(['"', repeatFrom0(character), '"'])

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

export const number = /**@type {const}*/([
    optionNeg,
    uint,
    ...optionFloatSuffix
])

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
 * @type {<const Item extends Rule>(oc: string, item: Item) => Container<Item>}
 */
export const cj = (oc, item) => {
    const p = [...oc]
    assert(isFixedArray2(p))
    const [open, close] = p
    return [open, ws, join([',', ws])([item, ws]), close]
}

/**
 * The items of a container `cj` built, in order, read out of the node the
 * machine built for it: each item is followed by its whitespace, and the
 * list is `join`ed by a comma and whitespace. The pairs are scaffolding
 * `cj` builds and hands to nobody, so no mapping ever fills them; the items
 * may be mapped, and are returned as they stand. Typed by the shape of the
 * node, as `joined` is.
 *
 * @type {<T>(node: ContainerNode<T>) => readonly T[]}
 */
export const items = ([, , list]) => joined(unmapped(list)).map(pair => unmapped(pair)[0])

/** @type {<const V extends Rule>(v: V) => Container<V>} */
export const array = v => cj('[]', v)

/** @type {<const P extends Rule, const V extends Rule>(p: P, v: V) => Container<Entry<P, V>>} */
export const object = (p, v) => cj('{}', [p, ws, ':', ws, v])

/** @type {<const P extends Rule, const V extends Rule>(p: P, v: V) => Value<P, V>} */
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
 * rule, which is what tells a consumer apart from a set or a repetition. The
 * type names itself the same way, in `./types.ts`.
 *
 * @type {JsonValue}
 */
export const value = () => ['const', createValue(string, value)]

export const json = /**@type {const}*/([ws, value, ws])
