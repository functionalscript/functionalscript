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

/**
 * The bit operations of `bigint`; any size of universe.
 *
 * @type {BitOps<bigint>}
 */
export const bigintOps = {
    one: n => 1n << BigInt(n),
    mask: len => bigintMask(BigInt(len)),
    or: a => b => a | b,
    and: a => b => a & b,
    xor: a => b => a ^ b,
}

/**
 * The bit operations of `number`. JavaScript's bitwise operators work on 32-bit
 * signed integers, so a universe has at most 30 members.
 *
 * @type {BitOps<number>}
 */
export const numberOps = {
    one: n => 1 << n,
    mask: len => (1 << len) - 1,
    or: a => b => a | b,
    and: a => b => a & b,
    xor: a => b => a ^ b,
}

/**
 * Builds the set operations over the members `0..size - 1`.
 *
 * @template T
 * @param {BitOps<T>} ops
 * @returns {(size: number) => BitSet<T>}
 */
export const bitSet = ({ one, mask, or, and, xor }) => size => {
    const empty = mask(0)
    const universe = mask(size)
    const complement = xor(universe)
    /** @type {(a: T) => (b: T) => T} */
    const difference = a => b => and(a)(complement(b))
    /** @type {(r: Range) => T} */
    const range = ([b, e]) => xor(mask(e + 1))(mask(b))
    return {
        empty,
        universe,
        has: n => s => and(s)(one(n)) !== empty,
        one,
        range,
        union: or,
        intersect: and,
        complement,
        difference,
        set: n => or(one(n)),
        setRange: r => or(range(r)),
        unset: n => s => difference(s)(one(n)),
    }
}
