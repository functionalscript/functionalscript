/**
 * A set of integers, as a canonical list of half-open boundaries. See
 * `./types.ts` for the `RangeSet` value and what its boundaries mean.
 *
 * @module
 *
 * @import { Reduce } from '../function/operator/types.ts'
 * @import { Range } from '../range/types.ts'
 * @import { RangeMapArray } from '../range_map/types.ts'
 * @import { RangeSet } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { bsearch } from '../function/compare/module.f.mjs'
import { toArray } from '../list/module.f.mjs'
import { cmp } from '../number/module.f.mjs'
import { merge } from '../sorted_list/module.f.mjs'

/**
 * The empty set, the identity of `union`.
 *
 * @type {RangeSet}
 */
export const empty = []

/**
 * Every integer: the identity of `intersection`, and the set `complement`
 * complements against.
 *
 * @type {RangeSet}
 */
export const full = [-Infinity]

/**
 * Whether `s` is a valid set: strictly increasing safe integers, save for a
 * leading `-Infinity`, which is the universe's own bottom rather than a symbol.
 *
 * @type {(s: readonly number[]) => boolean}
 */
export const isRangeSet = s => s.every((v, i) =>
    i === 0
        ? v === -Infinity || Number.isSafeInteger(v)
        : Number.isSafeInteger(v) && v > s[i - 1])

/**
 * The one door a set of boundaries comes through. It panics on a list that is
 * not one: the algebra below reads every set as canonical, so an unsorted or
 * non-integer list has no meaning to give it, and the mistake belongs to
 * whoever wrote the boundaries down.
 *
 * @type {(s: readonly number[]) => RangeSet}
 */
export const rangeSet = s => {
    assert(isRangeSet(s), s)
    return s
}

/**
 * The closed range `a..b`, which is the two boundaries `[a, b + 1]`. An empty
 * or reversed range is not a set with no members but a mistake, and panics.
 *
 * @type {(r: Range) => RangeSet}
 */
export const fromRange = ([a, b]) => rangeSet([a, b + 1])

/**
 * Membership: the parity of the number of boundaries at or below `v`, found by
 * binary search.
 *
 * @type {(s: RangeSet) => (v: number) => boolean}
 */
export const contains = s => {
    const search = bsearch(s.length)
    return v => search(mid => v < s[mid] ? -1 : 1) % 2 === 1
}

/**
 * The complement against every integer — one toggle at the bottom of the
 * universe.
 *
 * That universe is never a grammar's alphabet: an alphabet-scoped complement is
 * `difference` against that alphabet's own set, which is the alphabet's to own
 * rather than this module's.
 *
 * @type {(s: RangeSet) => RangeSet}
 */
export const complement = s => s[0] === -Infinity ? s.slice(1) : [-Infinity, ...s]

const mergeSorted = merge(cmp)

/**
 * Membership in the result of `op`, at one point.
 *
 * @type {(op: Reduce<boolean>) => (a: RangeSet) => (b: RangeSet) => (v: number) => boolean}
 */
const mergeMember = op => a => b => {
    const inA = contains(a)
    const inB = contains(b)
    return v => op(inA(v))(inB(v))
}

/**
 * Every binary operation is one sweep of the boundaries of both sets, since
 * membership on either side — and so `op` of the two — can only change at one
 * of them. A candidate survives when membership below it differs from
 * membership at it, which is exactly what makes the result canonical: a
 * boundary that toggles nothing is never written.
 *
 * `op(false)(false)` must be `false`. Below every boundary of both sides a
 * valid set is off, and a result that is on there has no first boundary to say
 * so.
 *
 * @type {(op: Reduce<boolean>) => (a: RangeSet) => (b: RangeSet) => RangeSet}
 */
const mergeWith = op => a => b => {
    const member = mergeMember(op)(a)(b)
    return toArray(mergeSorted(a)(b))
        .filter((v, i, all) => member(v) !== (i !== 0 && member(all[i - 1])))
}

/** @type {(a: RangeSet) => (b: RangeSet) => RangeSet} */
export const union = mergeWith(a => b => a || b)

/** @type {(a: RangeSet) => (b: RangeSet) => RangeSet} */
export const intersection = mergeWith(a => b => a && b)

/** @type {(a: RangeSet) => (b: RangeSet) => RangeSet} */
export const difference = mergeWith(a => b => a && !b)

/**
 * The same set as a `range_map` of `boolean`, which is what a dispatch map is
 * built from.
 *
 * A `range_map` entry carries an *inclusive* upper bound, so a set that runs to
 * `Infinity` needs `max`, the largest symbol of the alphabet it is read over.
 * The universe has no such bound of its own, which is also what makes `max` the
 * place to check the set against the alphabet: a boundary above `max + 1` is
 * outside it, and panics.
 *
 * @type {(max: number) => (s: RangeSet) => RangeMapArray<boolean>}
 */
export const toRangeMap = max => s => {
    assert(s.length === 0 || s[s.length - 1] <= max + 1, [max, s])
    /** @type {RangeMapArray<boolean>} */
    const entries = s.map((v, i) => [i % 2 === 1, v - 1])
    return s.length % 2 === 0 ? entries : [...entries, [true, max]]
}
