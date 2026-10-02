/**
 * Types for the bitmask-as-set algebra.
 *
 * @module
 */

import type { Reduce } from '../function/operator/types.ts'
import type { Range } from '../range/types.ts'

/**
 * The bit operations of an integer type a `BitSet` is stored in. The type is a
 * primitive, so `bitSet` compares its values with `!==`.
 */
export type BitOps<T extends number | bigint> = {
    /** The integer with only bit `n` set. */
    readonly one: (n: number) => T
    /** The integer with the low `len` bits set. */
    readonly mask: (len: number) => T
    readonly or: Reduce<T>
    readonly and: Reduce<T>
    readonly xor: Reduce<T>
}

/**
 * Set operations over the members `0..size - 1`, where member `n` is bit `n`
 * of a `T`. Built by `bitSet` in `./module.f.mjs`. An operation that builds a
 * set refuses a member outside the universe; `has` answers `false` for one.
 */
export type BitSet<T extends number | bigint> = {
    readonly empty: T
    readonly universe: T
    readonly has: (n: number) => (s: T) => boolean
    readonly one: (n: number) => T
    /** The members from `r[0]` to `r[1]`, both inclusive. */
    readonly range: (r: Range) => T
    readonly union: Reduce<T>
    readonly intersect: Reduce<T>
    readonly complement: (s: T) => T
    readonly difference: Reduce<T>
    readonly set: (n: number) => (s: T) => T
    readonly setRange: (r: Range) => (s: T) => T
    readonly unset: (n: number) => (s: T) => T
}
