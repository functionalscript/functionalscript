/**
 * Construct evaluated EDAG arrays and join their elements as strings.
 * Construction evaluates items left to right; the first failure passes through
 * unchanged and stops all later items. Array spreads retain their element identities,
 * and strings spread by JavaScript's Unicode code-point iteration.
 *
 * Each successful construction creates a fresh array value. Non-iterable
 * spreads fail with tagged undefined. Operands supply valid EdagValue forms.
 *
 * Joining consumes an evaluated array and an already converted separator.
 * Null and tagged undefined contribute empty text; every other element is
 * passed unchanged to the supplied string converter, in order. A conversion
 * failure passes through unchanged and stops later conversions. Nested arrays
 * and functions use that same converter. Callers own separator conversion and
 * defaulting, even for an empty array, and the full value-to-string operation.
 *
 * @module
 * @import { EdagValue, Values, Array as ValueArray } from '../types.ts'
 * @import { ItemsOver } from '../../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'
import { typeOf } from '../semantics/module.f.mjs'

/** The evaluated elements of an iterable value, or null. @param {EdagValue} value */
const spreadValues = value => {
    if (typeof value === 'string') { return [...value] }
    return isArray(value) && value[0] === '[]' ? value[1] : null
}

/** Builds an array, resolving each spread in order. @type {(items: ItemsOver<ValueThunk>) => Result<ValueArray, EdagValue>} */
export const array = items => {
    /** @type {Values} */
    let values = []
    for (const item of items) {
        const spread = typeof item !== 'function'
        const result = (spread ? item[1] : item)()
        const [kind, value] = result
        if (kind === 'error') { return result }
        const elements = spread ? spreadValues(value) : [value]
        if (elements === null) { return error(['undefined']) }
        values = [...values, ...elements]
    }
    return ok(['[]', values])
}

/** Array join with a resolved separator and element ToString. @type {(value: ValueArray, separator: string, toString: (element: EdagValue) => Result<string, EdagValue>) => Result<string, EdagValue>} */
export const join = (value, separator, toString) => {
    let text = ''
    let prefix = ''
    for (const element of value[1]) {
        const result = element === null || typeOf(element) === 'undefined' ? ok('') : toString(element)
        const [kind, part] = result
        if (kind === 'error') { return result }
        text += prefix + part
        prefix = separator
    }
    return ok(text)
}
