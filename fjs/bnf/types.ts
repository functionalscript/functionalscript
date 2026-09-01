/**
 * Type-level API for BNF grammar primitives and helpers.
 *
 * @module
 */

import type { StringMap } from '../types/object/types.ts'

/**
 * A range of symbols. Two 24-bit endpoint codes are stored in one JS number
 * (48 bits).
 *
 * For example: 0xBBBBBB_EEEEEE
 * - 0xBBBBBB is the first endpoint's stored code (24 bits)
 * - 0xEEEEEE is the last endpoint's stored code (24 bits)
 *
 * A stored code is not the semantic terminal value: the semantic domain is
 * `[-1] | [0, 2 ** 24 - 2]` — EOF plus every ordinary symbol — and EOF's code
 * is `0xFFFFFF`, the top of the stored space. `rangeEncode` / `rangeDecode` in
 * `./module.f.mjs` convert between the two, and everything that compares
 * terminals compares decoded values.
 *
 * 24 bits per half, not 26 (the most `float64`'s 52-bit safe-integer mantissa
 * could fit two of): 24 is divisible by 4, so each half is exactly 6 hex
 * digits, and the packed pair reads as a plain `0xYYYYYY_ZZZZZZ` literal with
 * no partial hex digit at either boundary. 26 bits would still be safe to
 * store but wouldn't align to hex nibbles, making the packed literal harder
 * to read and split by eye.
 *
 * Not 16 bits (32 bits total) either, even though a 32-bit pair would fit in
 * a JS bitwise operator's native 32-bit range (JS `|`/`&`/`<<`/etc. operate on
 * 32-bit ints, whereas the 48-bit pair used here, and even a 52-bit one,
 * would need converting to `BigInt` for bitwise operations). 16 bits per
 * symbol can't hold a full Unicode code point: the max scalar value `0x10FFFF`
 * needs 21 bits, well past `0xFFFF`. So the bitwise-op convenience of 16 loses
 * to the requirement of representing every Unicode code point in one half.
 */
export type TerminalRange = number

/** A sequence of rules. */
export type Sequence = readonly Rule[]

/** A variant */
export type Variant = { readonly[k in string]?: Rule }

/**
 * Data-only grammar rule.
 */
export type DataRule = Variant | Sequence | TerminalRange | string

/**
 * Lazily evaluated grammar rule.
 */
export type LazyRule = () => DataRule

/**
 * Grammar rule, either immediate data or lazy rule factory.
 */
export type Rule = DataRule | LazyRule

/**
 * A set of terminal ranges compatible with the `Variant` rule.
 */
export type RangeVariant = StringMap<TerminalRange>

/**
 * Empty sequence type for optional grammar branches.
 */
export type None = readonly[]

/**
 * Optional grammar branch.
 */
export type Option<S> = {
    readonly some: S
    readonly none: None
}

export type Repeat0Plus<T> = () => Option<readonly[T, Repeat0Plus<T>]>

export type Repeat1Plus<T> = readonly[T, Repeat0Plus<T>]

export type Join1Plus<T, S> = readonly[T, Repeat0Plus<readonly[S, T]>]

export type Join0Plus<T, S> = Option<readonly[T, Repeat0Plus<readonly[S, T]>]>
