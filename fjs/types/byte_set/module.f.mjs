/**
 * Compact byte-set operations and predicates: the
 * {@link ../bit_set/module.f.mjs | `bit_set`} algebra over a 256-bit `bigint`.
 * See `./types.ts` for the `ByteSet` type.
 *
 * @module
 *
 * @import { RangeMap } from '../range_map/types.ts'
 * @import { ByteSet, _Byte } from './types.ts'
 */

import { bitSet, bigintOps } from '../bit_set/module.f.mjs'
import { reverse, countdown, flat, map } from '../list/module.f.mjs'

const byteSet = bitSet(bigintOps)(256)

/** @type {(n: _Byte) => (s: ByteSet) => boolean} */
export const has = byteSet.has

// create a set

export const empty = byteSet.empty

export const universe = byteSet.universe

/** @type {(n: _Byte) => ByteSet} */
export const one = byteSet.one

/** @type {(r: readonly [_Byte, _Byte]) => ByteSet} */
export const range = byteSet.range

// set operations

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
export const union = byteSet.union

/** @type {(n: ByteSet) => ByteSet} */
export const complement = byteSet.complement

// additional operations

/** @type {(_: number) => (b: ByteSet) => ByteSet} */
export const set = byteSet.set

/** @type {(_: readonly [number, number]) => (b: ByteSet) => ByteSet} */
export const setRange = byteSet.setRange

/** @type {(n: _Byte) => (s: ByteSet) => ByteSet} */
export const unset = byteSet.unset

const counter = reverse(countdown(256))

/** @type {(n: ByteSet) => (i: number) => RangeMap<boolean>} */
const toRangeMapOp = n => i => {
    const current = has(i + 1)(n)
    const prev = has(i)(n)
    return current === prev ? null : [[prev, i]]
}

/**
 * Re-expresses the set as a range map: one entry per membership boundary,
 * carrying whether the range up to that byte is in the set.
 *
 * The payload is the set's own answer — `boolean` — and nothing more. A caller
 * that needs ranges labelled with something else maps over the result; that
 * labelling belongs to the caller, not to a byte set.
 *
 * @type {(n: ByteSet) => RangeMap<boolean>}
 */
export const toRangeMap = n => flat(map(toRangeMapOp(n))(counter))
