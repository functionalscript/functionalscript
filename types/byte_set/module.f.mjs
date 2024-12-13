// @ts-self-types="./module.f.d.mts"
import * as f from '../function/module.f.mjs'
const { compose } = f
import * as RangeMap from '../range_map/module.f.mjs'
import * as SortedSet from '../sorted_set/module.f.mjs'
import * as list from '../list/module.f.mjs'
const { reverse, countdown, flat, map } = list

/** @typedef {bigint} ByteSet */
/** @typedef {number} Byte */

/** @type {(n: Byte) => (s: ByteSet) => boolean} */
export const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

// create a set

export const empty = 0n

//                        0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F
export const universe = 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn

/** @type {(n: Byte) => ByteSet} */
export const one = n => 1n << BigInt(n)

/** @type {(r: readonly[Byte, Byte]) => ByteSet} */
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

export const set = compose(one)(union)

export const setRange = compose(range)(union)

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
export const unset = n => s => difference(s)(one(n))

const counter = reverse(countdown(256))

/** @type {(n: ByteSet) => (s: string) => (i: number) => RangeMap.RangeMap<SortedSet.SortedSet<string>>} */
const toRangeMapOp = n => s => i => {
    const current = has(i + 1)(n)
    const prev = has(i)(n)
    return current === prev ? null : [[prev ? [s] : [], i]]
}

/** @type {(n: ByteSet) => (s: string) => RangeMap.RangeMap<SortedSet.SortedSet<string>>} */
export const toRangeMap = n => s => flat(map(toRangeMapOp(n)(s))(counter))
