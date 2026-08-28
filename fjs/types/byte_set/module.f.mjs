/**
 * Compact byte-set operations and predicates. See `./types.ts` for the
 * `ByteSet` type.
 *
 * @module
 *
 * @import { RangeMap } from '../range_map/types.ts'
 * @import { ByteSet, _Byte } from './types.ts'
 */

import { compose } from '../function/module.f.mjs'
import { reverse, countdown, flat, map } from '../list/module.f.mjs'

/** @type {(n: _Byte) => (s: ByteSet) => boolean} */
export const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

// create a set

export const empty = 0n

//                        0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F
export const universe = 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn

/** @type {(n: _Byte) => ByteSet} */
export const one = n => 1n << BigInt(n)

/** @type {(r: readonly [_Byte, _Byte]) => ByteSet} */
export const range = ([b, e]) => one(e - b + 1) - 1n << BigInt(b)

// set operations

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
export const union = a => b => a | b

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const intersect = a => b => a & b

/** @type {(n: ByteSet) => ByteSet} */
export const complement = n => universe ^ n

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const difference = compose(intersect)(compose(complement))

// additional operations

/** @type {(_: number) => (b: ByteSet) => ByteSet} */
export const set = compose(one)(union)

/** @type {(_: readonly [number, number]) => (b: ByteSet) => ByteSet} */
export const setRange = compose(range)(union)

/** @type {(n: _Byte) => (s: ByteSet) => ByteSet} */
export const unset = n => s => difference(s)(one(n))

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
