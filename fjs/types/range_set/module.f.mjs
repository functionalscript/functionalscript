/**
 * A set of numeric ranges, represented as a `range_map` of `boolean`.
 *
 * @module
 */

import { rangeMap } from '../range_map/module.f.mjs'

const map = rangeMap({
    union: a => b => a || b,
    equal: a => b => a === b,
    def: false,
})

/**
 * Constructs a range set containing a single numeric range.
 */
export const fromRange = map.fromRange(true)

export const { merge, get } = map
