/**
 * Big-float helpers built from bigint mantissa and exponent parts.
 *
 * @module
 *
 * @import { BigFloat, Format } from './types.ts'
 * @import { Nullable } from '../nullable/types.ts'
 * @import { _BigFloatWithRemainder } from './private.ts'
 */

import { abs, bitLength, mask, sign } from '../bigint/module.f.mjs'

/** @type {(exp: number) => bigint} */
const twoPow = exp => 1n << BigInt(exp)

/**
 * Doubles the mantissa magnitude one bit at a time, compensating the exponent,
 * until it reaches `min`; the sign is restored on return. A zero mantissa is
 * returned unchanged: it can never reach a lower bound, so shifting it would
 * not terminate.
 *
 * There is no downward twin: a magnitude that overshoots is brought back by
 * `truncate`, which has to know what it cut off and so cannot be a shift loop.
 *
 * @type {(_: BigFloat) => (min: bigint) => BigFloat}
 */
const increaseMantissa = ([m, e]) => min => {
    if (m === 0n) {
        return [m, e]
    }
    const s = sign(m)
    m = abs(m)
    while (m < min) {
        m <<= 1n
        e -= 1
    }
    return [BigInt(s) * m, e]
}

/** @type {(base: bigint) => (exp: number) => bigint} */
const pow = base => exp => base ** BigInt(exp)

const pow5 = pow(5n)

/** @type {(_: BigFloat) => (mul: bigint) => BigFloat} */
export const multiply = ([m, e]) => mul => [m * mul, e]

/** @type {(_: BigFloat) => (div: bigint) => _BigFloatWithRemainder} */
const divide = ([m, e]) => div => [[m / div, e], m % div]

/**
 * IEEE-754 binary64 — the format of a JavaScript `number`.
 *
 * Both exponents are *ulp* exponents, the same units a `BigFloat`'s own
 * exponent is in: `minExp` is the exponent of the smallest subnormal
 * (`2^-1074`), not the smallest normal's `-1022`, and `maxExp` is the exponent
 * the largest finite value carries once its mantissa fills `precision` bits
 * (`(2^53 - 1) * 2^971`). The two conventions differ by the precision, and a
 * `Format` that mixes them is off by exactly that much, so this one never
 * leaves `BigFloat`'s units.
 *
 * @type {Format}
 */
export const binary64 = { precision: 53, minExp: -1074, maxExp: 971 }

/**
 * Runs `f` on the magnitude `[abs(m), e]` and restores the sign of `m` on the
 * result: operations on signed mantissas factor through the magnitude.
 *
 * @type {(m: bigint, e: number) => (f: (magnitude: BigFloat) => BigFloat) => BigFloat}
 */
const withSign = (m, e) => f => multiply(f([abs(m), e]))(BigInt(sign(m)))

/**
 * Truncates a magnitude to `precision + 1` bits, folding the bits it drops
 * into the remainder. A magnitude already that narrow is returned unchanged.
 *
 * @type {(precision: number) => (_: _BigFloatWithRemainder) => _BigFloatWithRemainder}
 */
const truncate = precision => ([[m, e], r]) => {
    const k = bitLength(m) - BigInt(precision + 1)
    return k <= 0n ? [[m, e], r] : [[m >> k, e + Number(k)], r | (m & mask(k))]
}

/**
 * Scales a non-zero decimal magnitude `dm * 10^de` into `[[m, e], r]` where
 * `m` holds exactly `precision + 1` bits.
 *
 * One bit more than the precision is kept on purpose. Truncating to *any*
 * position at or below the bit the rounding turns on, plus a remainder saying
 * whether anything was cut off, is everything a single correctly-rounded
 * decision needs — at this precision or at any coarser one, which is what
 * makes the subnormal range reachable without rounding twice.
 *
 * @type {(precision: number) => (magnitude: BigFloat) => _BigFloatWithRemainder}
 */
const scale = precision => ([dm, de]) => {
    const lo = twoPow(precision)
    if (de >= 0) {
        // `dm * 10^de` is a whole number, so nothing is lost until `truncate`.
        return truncate(precision)([increaseMantissa([dm * pow5(de), de])(lo), 0n])
    }
    const p5 = pow5(-de)
    return truncate(precision)(divide(increaseMantissa([dm, de])(p5 * lo))(p5))
}

/**
 * Rounds a truncated magnitude to a multiple of `2^(e + k)`, ties to even.
 *
 * `k` is at least 1, so the bit the decision turns on is still inside `m`:
 * `dropped` against `half` is the comparison against the midpoint, and a
 * non-zero remainder is what lifts an apparent midpoint above it.
 *
 * @type {(k: number) => (_: _BigFloatWithRemainder) => BigFloat}
 */
const round = k => ([[m, e], r]) => {
    const kb = BigInt(k)
    const q = m >> kb
    const dropped = m & mask(kb)
    const half = 1n << (kb - 1n)
    const up = dropped > half || (dropped === half && (r !== 0n || (q & 1n) === 1n))
    return [up ? q + 1n : q, e + k]
}

/**
 * Re-normalizes a magnitude that rounding carried out of `precision` bits:
 * rounding `2^precision - 1` up yields exactly `2^precision`, one bit wider
 * than the caller promises. The bit shifted out is always 0 there, so the
 * value is unchanged and no second rounding decision is needed.
 *
 * @type {(precision: number) => (magnitude: BigFloat) => BigFloat}
 */
const renormalize = precision => ([m, e]) =>
    m === twoPow(precision) ? [m >> 1n, e + 1] : [m, e]

/**
 * Converts a decimal big-float `m * 10^e` into the nearest binary big-float,
 * rounding ties to even.
 *
 * A zero input returns `[0n, 0]`; every other input returns a mantissa of
 * exactly 53 significant bits, `2^52 <= abs(m) < 2^53`. The upper bound holds
 * even when rounding carries out of the top bit.
 *
 * The **exponent is unbounded**: this is the correctly-rounded 53-bit value,
 * not a `number`. A result too large for a `double` is not turned into an
 * infinity, and one below the normal range keeps all 53 bits instead of the
 * fewer a subnormal carries. That is the honest answer when the target is not
 * a `double` — and the wrong starting point when it is, because rounding one
 * of these results onto the subnormal grid rounds twice and can land an ulp
 * away from the correctly-rounded `double`. Use {@link tryDecToFormat} with
 * {@link binary64} for that; it rounds once.
 *
 * @type {(dec: BigFloat) => BigFloat}
 */
export const decToBin = ([dm, de]) => {
    if (dm === 0n) {
        return [0n, 0]
    }
    const { precision } = binary64
    return withSign(dm, de)(magnitude =>
        renormalize(precision)(round(1)(scale(precision)(magnitude))))
}

/**
 * Converts a decimal big-float `m * 10^e` into the nearest value of `format`,
 * rounding ties to even, or `null` when the magnitude is too large for the
 * format to hold — the caller decides what an overflow becomes, since
 * `BigFloat` has no encoding for an infinity.
 *
 * The result is a multiple of `2^format.minExp` carrying **at most**
 * `format.precision` significant bits: exactly that many above the format's
 * normal range, fewer below it, and `[0n, 0]` when the value rounds away
 * entirely. Underflow to zero is not a separate signal, because `[0n, 0]` is
 * the correctly-rounded answer rather than a failure to produce one.
 *
 * The rounding happens **once**, on the exact decimal, which is the whole
 * point of taking the format rather than post-processing {@link decToBin}. The
 * grid it rounds onto is `2^max(minExp, e + 1)`, where `e + 1` is the exponent
 * a full-precision result would carry: full precision above the normal range's
 * floor, shrinking by a bit per binade below it, down to none at all. Rounding
 * to `precision` bits first and onto that grid afterwards is two roundings,
 * and the first can manufacture a midpoint the true value only approached.
 *
 * @type {(format: Format) => (dec: BigFloat) => Nullable<BigFloat>}
 */
export const tryDecToFormat = ({ precision, minExp, maxExp }) => ([dm, de]) => {
    if (dm === 0n) {
        return [0n, 0]
    }
    const scaled = scale(precision)([abs(dm), de])
    const [, e] = scaled[0]
    const [m, resultE] = renormalize(precision)(round(Math.max(minExp - e, 1))(scaled))
    if (bitLength(m) + BigInt(resultE) > BigInt(precision + maxExp)) {
        return null
    }
    return m === 0n ? [0n, 0] : multiply([m, resultE])(BigInt(sign(dm)))
}

export const proof = {
    // normalizeMantissa guards against zero mantissa to prevent an infinite loop;
    // this path is unreachable through decToBin (which returns early for 0n),
    // so we exercise it here where the private helper is in scope.
    normalizeMantissaZero: () => { increaseMantissa([0n, 5])(1n) }
}
