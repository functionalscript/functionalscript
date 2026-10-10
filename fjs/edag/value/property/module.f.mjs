/**
 * Property lookup over evaluated EDAG values. Objects expose their stored
 * fields, arrays their elements and length, strings their UTF-16 code units
 * and length, and functions their declared length. Missing properties are
 * tagged undefined; nullish receivers fail with tagged undefined. Stored
 * values and receiver failures retain their identities.
 *
 * This is the lookup kernel for admitted property reads, `read`, and for
 * a call of the `entry` helper, `entry`: the same lookup less what a value
 * owns without enumerating it, a `length` and whatever a function has.
 * The caller owns operand evaluation order, key conversion to a string and
 * source-name admission. Reads do not traverse prototypes or expose storage
 * tuple fields; findProperty supplies stored object-property presence to
 * operations. Method dispatch remains separate work. Values satisfy the
 * compiler/admission contract and are not revalidated.
 *
 * @module
 * @import { EdagValue, Values, Object as ValueObject, Property } from '../types.ts'
 * @import { ValueResult } from '../control/types.ts'
 */

import { arrayIndex } from '../../../js/array_index/module.f.js'
import { isArray } from '../../../types/array/module.f.mjs'
import { ok, error } from '../../../types/result/module.f.mjs'

/**
 * Find a stored object property, retaining its tuple identity. An absent
 * property returns undefined; a present tagged-undefined value still has a
 * property tuple. Coercion and method dispatch need that distinction.
 * @type {(value: ValueObject, key: string) => Property | undefined}
 */
export const findProperty = (value, key) => value[1].find(([, name]) => name === key)

/** The element `key` names, an array's or a string's: by its canonical index, within the length. @type {(values: Values | string, key: string) => ValueResult} */
const element = (values, key) => {
    const index = arrayIndex(key)
    return ok(index === null || index >= values.length ? ['undefined'] : values[index])
}

/** An element, or the `length` an array and a string own beside their elements. @type {(values: Values | string, key: string) => ValueResult} */
const indexed = (values, key) => key === 'length' ? ok(values.length) : element(values, key)

/** The stored field `key` names, or tagged undefined. @type {(value: ValueObject, key: string) => ValueResult} */
const field = (value, key) => {
    const property = findProperty(value, key)
    return ok(property === undefined ? ['undefined'] : property[2])
}

/** Read a resolved property, preserving a failed receiver unchanged. @type {(receiver: ValueResult, key: string) => ValueResult} */
export const read = (receiver, key) => {
    const [kind, value] = receiver
    if (kind === 'error') { return receiver }
    if (value === null) { return error(['undefined']) }
    if (typeof value === 'string') { return indexed(value, key) }
    if (!isArray(value)) { return ok(['undefined']) }
    switch (value[0]) {
        case '[]': { return indexed(value[1], key) }
        case '{}': { return field(value, key) }
        case '=>': { return ok(key === 'length' ? value[1] : ['undefined']) }
        // the `entry` helper owns the `length` every function does, `2`
        case 'entry': { return ok(key === 'length' ? 2 : ['undefined']) }
        default: { return error(['undefined']) }
    }
}

/**
 * The entry `key` names: what a call of the `entry` helper reads, over a
 * key already converted to a string — the enumerable own property, as
 * the helper reads it, `Object.getOwnPropertyDescriptor` followed by
 * `x?.enumerable ? x.value : undefined`. An object's stored field, an
 * array's element or a string's code unit by its canonical index, and
 * nothing else: a `length` is own but enumerates nowhere, a function has
 * no entry at all, and neither has any other primitive. A nullish receiver
 * fails, as `Object.getOwnPropertyDescriptor` throws on one.
 *
 * @type {(receiver: EdagValue, key: string) => ValueResult}
 */
export const entry = (receiver, key) => {
    if (receiver === null) { return error(['undefined']) }
    if (typeof receiver === 'string') { return element(receiver, key) }
    if (!isArray(receiver)) { return ok(['undefined']) }
    switch (receiver[0]) {
        case '[]': { return element(receiver[1], key) }
        case '{}': { return field(receiver, key) }
        case '=>': case 'entry': { return ok(['undefined']) }
        default: { return error(['undefined']) }
    }
}
