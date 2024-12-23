import { compose } from '../function/module.f.ts'
import * as RangeMap from '../range_map/module.f.ts'
import * as SortedSet from '../sorted_set/module.f.ts'
import * as list from '../list/module.f.ts'
const { reverse, countdown, flat, map } = list

export type ByteSet = bigint
type Byte = number

export const has
    : (n: Byte) => (s: ByteSet) => boolean
    = n => s => ((s >> BigInt(n)) & 1n) === 1n

// create a set

export const empty = 0n

//                        0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F
export const universe = 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn

export const one
    : (n: Byte) => ByteSet
    = n => 1n << BigInt(n)

export const range
    : (r: readonly[Byte, Byte]) => ByteSet
    = ([b, e]) => one(e - b + 1) - 1n << BigInt(b)

// set operations

export const union
    : (a: ByteSet) => (b: ByteSet) => ByteSet
    = a => b => a | b

const intersect
    : (a: ByteSet) => (b: ByteSet) => ByteSet
    = a => b => a & b

export const complement
    : (n: ByteSet) => ByteSet
    = n => universe ^ n

const difference
    : (a: ByteSet) => (b: ByteSet) => ByteSet
    = compose(intersect)(compose(complement))

// additional operations

export const set
: (_: number) => (b: ByteSet) => ByteSet
= compose(one)(union)

export const setRange
: (_: readonly [number, number]) => (b: ByteSet) => ByteSet
= compose(range)(union)

export const unset
: (n: Byte) => (s: ByteSet) => ByteSet
= n => s => difference(s)(one(n))

const counter = reverse(countdown(256))

const toRangeMapOp
    : (n: ByteSet) => (s: string) => (i: number) => RangeMap.RangeMap<SortedSet.SortedSet<string>>
    = n => s => i => {
    const current = has(i + 1)(n)
    const prev = has(i)(n)
    return current === prev ? null : [[prev ? [s] : [], i]]
}

export const toRangeMap
    : (n: ByteSet) => (s: string) => RangeMap.RangeMap<SortedSet.SortedSet<string>>
    = n => s => flat(map(toRangeMapOp(n)(s))(counter))
