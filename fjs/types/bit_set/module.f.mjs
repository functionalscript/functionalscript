/**
 * The bitmask-as-set algebra, shared by `byte_set` and `nibble_set`.
 *
 * A set of small non-negative integers is stored as one integer whose bit `n`
 * says whether `n` is a member. `bitSet` builds the set operations from the bit
 * operations of the integer type, so each set module only picks the type and
 * the size of its universe.
 *
 * @module
 *
 * @import { Range } from '../range/types.ts'
 * @import { BitOps, BitSet } from './types.ts'
 */

import { mask as bigintMask } from '../bigint/module.f.mjs'
import { assert } from '../../asserts/module.f.mjs'

const { isInteger } = Number

/**
 * `n`, asserted to be a bit index a shift keeps: an integer from `0` to `max`.
 * Any other index answers with a plausible wrong set: a negative `bigint`
 * shift reverses direction, and a `number` shift truncates a fraction and
 * wraps past bit 30 (`1 << 31` is negative and `1 << 32` is `1`).
 *
 * @type {(max: number) => (n: number) => number}
 */
const bitIndex = max => n => {
    assert(isInteger(n) && 0 <= n && n <= max, ['bit index outside 0..max', n, max])
    return n
}

const bigintBit = bitIndex(Infinity)

/**
 * The bit operations of `bigint`; any size of universe. A negative or
 * fractional member or size is refused.
 *
 * @type {BitOps<bigint>}
 */
export const bigintOps = {
    one: n => 1n << BigInt(bigintBit(n)),
    mask: len => bigintMask(BigInt(bigintBit(len))),
    or: a => b => a | b,
    and: a => b => a & b,
    xor: a => b => a ^ b,
}

const numberBit = bitIndex(30)

/**
 * The bit operations of `number`. A universe has at most 30 members, and a
 * member or size beyond that, negative or fractional is refused.
 *
 * @type {BitOps<number>}
 */
export const numberOps = {
    one: n => 1 << numberBit(n),
    mask: len => (1 << numberBit(len)) - 1,
    or: a => b => a | b,
    and: a => b => a & b,
    xor: a => b => a ^ b,
}

/**
 * Builds the set operations over the members `0..size - 1`.
 *
 * Every operation that builds a set refuses a member outside the universe,
 * and `range` a reversed range: either would answer with bits past `universe`
 * or the wrong run of bits. `has` is a query, so a member past the universe is
 * simply not in the set.
 *
 * @template {number | bigint} T
 * @param {BitOps<T>} ops
 * @returns {(size: number) => BitSet<T>}
 */
export const bitSet = ({ one, mask, or, and, xor }) => size => {
    const empty = mask(0)
    const universe = mask(size)
    const member = bitIndex(size - 1)
    /** @type {(n: number) => T} */
    const memberOne = n => one(member(n))
    const complement = xor(universe)
    /** @type {(a: T) => (b: T) => T} */
    const difference = a => b => and(a)(complement(b))
    /**
     * `bitIndex(e)` refuses a `b` past `e`, as `member` refuses an `e` past
     * the universe.
     *
     * @type {(r: Range) => T}
     */
    const range = ([b, e]) => xor(mask(member(e) + 1))(mask(bitIndex(e)(b)))
    return {
        empty,
        universe,
        has: n => s => and(s)(one(n)) !== empty,
        one: memberOne,
        range,
        union: or,
        intersect: and,
        complement,
        difference,
        set: n => or(memberOne(n)),
        setRange: r => or(range(r)),
        unset: n => s => difference(s)(memberOne(n)),
    }
}
