/**
 * A set of numbers, as a canonical list of half-open boundaries. See
 * `./types.ts` for the `RangeSet` value and what its boundaries mean.
 *
 * @module
 *
 * @import { Reduce } from '../function/operator/types.ts'
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
 * The whole universe: the identity of `intersection`, and the set `complement`
 * complements against. It opens at the universe's own bottom, which is a member
 * like any other.
 *
 * @type {RangeSet}
 */
export const full = [-Infinity]

/**
 * The universe is itself a half-open run, `-Infinity <= v < Infinity`. Its
 * bottom is a number like any other — a set that opens there contains it — and
 * `NaN`, which has no place in the order, is outside it along with `Infinity`.
 *
 * @type {(v: number) => boolean}
 */
const inUniverse = v => v === -Infinity || Number.isFinite(v)

/**
 * A boundary is a number of the universe that spells its run exactly once. That
 * leaves out only `-0`, a second spelling of `0`; `Infinity` is already out for
 * not being in the universe, which is the same thing as saying the run it would
 * open is empty, so `[Infinity]` would be a second spelling of `[]`.
 *
 * @type {(v: number) => boolean}
 */
const isBoundary = v => inUniverse(v) && !Object.is(v, -0)

/**
 * Whether `s` is a valid set: boundaries, strictly increasing. Being strictly
 * increasing is also what keeps `-Infinity` in the first position, and what
 * rejects a repeat or a decrease.
 *
 * The list is spread first because `Array#every` skips the holes of a sparse
 * array: `new Array(1)` would pass as a one-boundary set and then read as the
 * whole universe, since membership counts boundaries by length. Spreading
 * makes each hole the `undefined` it is, which is no boundary at all.
 *
 * @type {(s: readonly number[]) => boolean}
 */
export const isRangeSet = s => {
    const dense = [...s]
    return dense.every((v, i) => isBoundary(v) && (i === 0 || v > dense[i - 1]))
}

/** @type {(s: readonly number[]) => RangeSet} */
const validated = s => {
    assert(isRangeSet(s), s)
    return s
}

/**
 * The one door a set of boundaries comes through. It panics on a list that is
 * not one: the algebra below reads every set as canonical, so an unsorted list
 * or a second spelling of a number has no meaning to give it, and the mistake
 * belongs to whoever wrote the boundaries down.
 *
 * @type {(s: readonly number[]) => RangeSet}
 */
export const rangeSet = validated

/**
 * One run, `a <= x < b` — `rangeSet` at the shape most sets are written in,
 * and the name that says which end is exclusive.
 *
 * Every boundary is exclusive above, so a caller whose symbols are integers
 * writes the closed range `a..b` as `fromRange([a, b + 1])`: that `+ 1` is a
 * fact about integers, and it belongs where the symbols are known rather than
 * here, where boundaries are only ever compared.
 *
 * An empty or reversed run is not a set with no members but a mistake, and
 * panics.
 *
 * @type {(r: readonly [number, number]) => RangeSet}
 */
export const fromRange = validated

/**
 * Membership: the parity of the number of boundaries at or below `v`, found by
 * binary search.
 *
 * A probe outside the universe panics rather than being answered. `NaN` has no
 * place in the order, so every comparison against it is false and the search
 * would walk past every boundary and report membership; `Infinity` sits above
 * the universe, where no boundary can be written, so no set can say whether it
 * is a member. Answering `false` for either would be no better than a panic: it
 * would put the value in neither a set nor its complement, and
 * `contains(complement(s))(v) === !contains(s)(v)` is the one law a consumer
 * reads off this module without checking.
 *
 * `-0` is a probe like any other — it compares as `0`, which is the answer it
 * gets. Only a *boundary* has to be the one spelling of its number.
 *
 * @type {(s: RangeSet) => (v: number) => boolean}
 */
export const contains = s => {
    const search = bsearch(s.length)
    return v => {
        assert(inUniverse(v), v)
        return search(mid => v < s[mid] ? -1 : 1) % 2 === 1
    }
}

/**
 * The complement against every number — one toggle at the bottom of the
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
