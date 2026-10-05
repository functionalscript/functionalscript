/**
 * Construct evaluated EDAG arrays from deferred elements and spreads.
 * Items evaluate left to right; the first failure passes through unchanged
 * and stops all later items. Array spreads retain their element identities,
 * and strings spread by JavaScript's Unicode code-point iteration.
 *
 * Each successful construction creates a fresh array value. Non-iterable
 * spreads fail with tagged undefined. Operands supply valid EdagValue forms.
 *
 * @module
 * @import { EdagValue, Values, Array as ValueArray } from '../types.ts'
 * @import { ItemsOver } from '../../types.ts'
 * @import { ValueThunk } from '../control/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 */

import { isArray } from '../../../types/array/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.mjs'

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
