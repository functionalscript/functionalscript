/**
 * Numeric list reductions (`sum`, `min`, `max`), comparison via `cmp`,
 * `countOnes` for 32-bit population count using SWAR, and the `isUintUpTo`
 * and `isByte` predicates. IEEE 754 conversions encode a number as binary64
 * bits and decode binary32 or binary64 bits into an ordinary number.
 *
 * @module
 *
 * @import { List } from '../list/types.ts'
 * @import { Reduce } from '../function/operator/types.ts'
 * @import { Sign } from '../function/compare/types.ts'
 */

import { reduce } from '../list/module.f.js'
import { addition } from '../function/operator/module.f.js'
import { cmp as uCmp, min as uMin, max as uMax } from '../function/compare/module.f.js'
import { fold } from '../../common/monoid/module.f.js'
import { abs } from './abs/module.f.js'
import { isNegativeZero } from './is_negative_zero/module.f.js'
import { bigint } from '../bigint/from_number/module.f.js'

const { is: sameValue } = Object

/** @type {(input: List<number>) => number} */
export const sum = fold({ identity: 0, operation: addition, weight: abs })

/** @type {Reduce<number>} */
const minReduce = uMin

/** @type {(input: List<number>) => number | null} */
export const min = reduce(minReduce)(null)

/** @type {Reduce<number>} */
const maxReduce = uMax

/** @type {(input: List<number>) => number | null} */
export const max = reduce(maxReduce)(null)

/** @type {(a: number) => (b: number) => Sign} */
export const cmp = uCmp

/** @type {readonly (readonly [number, number])[]} */
const mo = [
    [0x5555_5555, 1],
    [0x3333_3333, 2],
    [0x0F0F_0F0F, 4],
    [0x00FF_00FF, 8],
    [0x0000_FFFF, 16],
]

/**
 * Count a number of ones in 32 bit number
 *
 * @type {(n: number) => number}
 */
export const countOnes = n => mo.reduce(
    (value, [mask, offset]) => (value & mask) + ((value >> offset) & mask),
    n,
)

/**
 * Whether `n` is an unsigned integer that fits `max`: an integer in `0..max`,
 * and not `-0`, which the data layer refuses as a second spelling of `0`.
 * The one spelling of "a non-negative integer up to `max`" — a byte, an index,
 * a code unit — so whether `-0` is one has one answer. `max` may be
 * `Infinity`, for every non-negative integer.
 *
 * @type {(max: number) => (n: unknown) => n is number}
 */
export const isUintUpTo = max =>
    /**
     * @param {unknown} n
     * @returns {n is number}
     */
    n => typeof n === 'number' && Number.isInteger(n) && 0 <= n && n <= max && !sameValue(n, -0)

/**
 * Whether `b` is a byte: an integer in `0..255`. The one byte predicate, for
 * a consumer that holds a `number` it means as a byte — a `List<number>` it
 * is about to write, say — and has to refuse one that is not.
 */
export const isByte = isUintUpTo(0xFF)

/**
 * The exponent of a normal number: the `e` with `2 ** e <= a < 2 ** (e + 1)`,
 * found by bisection over the exponent range, every step an exact
 * comparison against a power of two.
 *
 * @type {(a: number) => number}
 */
const exponentOf = a => {
    let low = -1_022
    let high = 1_024
    while (high - low > 1) {
        const mid = Math.floor((low + high) / 2)
        if (2 ** mid <= a) { low = mid } else { high = mid }
    }
    return low
}

/** The canonical binary64 quiet NaN. @type {bigint} */
const canonicalNan = 0x7ff8_0000_0000_0000n

/**
 * The IEEE 754 binary64 bits of a number, as an unsigned 64-bit `bigint`.
 * Preserves signed zero, infinities and every finite value. FunctionalScript
 * has one NaN, so every `NaN` uses the canonical quiet-NaN encoding
 * `0x7ff8000000000000`; host NaN payloads and signs are not observable here.
 *
 * @type {(v: number) => bigint}
 */
export const bitsOf = v => {
    if (Number.isNaN(v)) { return canonicalNan }
    const sign = v < 0 || isNegativeZero(v) ? 1n << 63n : 0n
    const a = Math.abs(v)
    if (a === Infinity) { return sign | 0x7ff0_0000_0000_0000n }
    if (a === 0) { return sign }
    // scaled in two exact steps: `2 ** 1074` itself is past the largest double
    if (a < 2 ** -1_022) { return sign | bigint(a * 2 ** 1_023 * 2 ** 51) }
    const exponent = exponentOf(a)
    const fraction = bigint((a / 2 ** exponent - 1) * 2 ** 52)
    return sign | bigint(exponent + 1_023) << 52n | fraction
}

/**
 * The shared decoder for binary32 and binary64. The integer significand fits
 * exactly in a number, and even binary64's smallest scale, `2 ** -1074`, is
 * representable. Their product is the encoded value without intermediate
 * rounding. Apply the sign last so zero keeps its sign too.
 *
 * @type {(exponentWidth: bigint, fractionWidth: bigint) => (bits: bigint) => number}
 */
const fromFormatBits = (exponentWidth, fractionWidth) => {
    const exponentMask = (1n << exponentWidth) - 1n
    const implicitBit = 1n << fractionWidth
    const fractionMask = implicitBit - 1n
    const signBit = implicitBit << exponentWidth
    const bias = exponentMask >> 1n
    return bits => {
        const exponent = (bits >> fractionWidth) & exponentMask
        const fraction = bits & fractionMask
        const magnitude = exponent === exponentMask
            ? fraction === 0n ? Infinity : NaN
            : Number(exponent === 0n ? fraction : implicitBit | fraction)
                * 2 ** Number((exponent === 0n ? 1n : exponent) - bias - fractionWidth)
        return (bits & signBit) === 0n ? magnitude : -magnitude
    }
}

/**
 * Decode the low 64 bits of `bits` as IEEE 754 binary64. Higher bits are
 * ignored; negative bigints supply their low two's-complement bits.
 * Preserves signed zero, subnormals and infinities. Every NaN encoding
 * becomes the language's NaN, so encoding it again with {@link bitsOf}
 * gives the canonical NaN bits.
 *
 * @type {(bits: bigint) => number}
 */
export const fromBits = fromFormatBits(11n, 52n)

/**
 * Decode the low 32 bits of `bits` as IEEE 754 binary32, with the same
 * width normalization as {@link fromBits}. The result is an ordinary FJS
 * number: every binary32 value is exactly representable in binary64.
 *
 * @type {(bits: bigint) => number}
 */
export const fromBits32 = fromFormatBits(8n, 23n)
