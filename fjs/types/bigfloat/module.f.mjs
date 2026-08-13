/**
 * Big-float helpers built from bigint mantissa and exponent parts.
 *
 * @module
 */

import { abs, sign } from '../bigint/module.f.mjs'
/** @import { BigFloat } from './types.ts' */

/** @typedef {readonly [BigFloat, bigint]} _BigFloatWithRemainder */

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
const twoPow54 = 0b0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/**
 * Shifts the mantissa magnitude one bit at a time, compensating the exponent,
 * until `done(magnitude, bound)` holds; the sign is restored on return.
 * A zero mantissa is returned unchanged: it can never satisfy a lower bound,
 * so shifting it would not terminate.
 *
 * @param {(m: bigint) => bigint} shift
 * @param {number} de
 * @param {(m: bigint, bound: bigint) => boolean} done
 * @returns {(_: BigFloat) => (bound: bigint) => BigFloat}
 */
const normalizeMantissa = (shift, de, done) => ([m, e]) => bound => {
    if (m === 0n) {
        return [m, e]
    }
    const s = sign(m)
    m = abs(m)
    while (true) {
        if (done(m, bound)) {
            return [BigInt(s) * m, e]
        }
        m = shift(m)
        e += de
    }
}

const increaseMantissa = normalizeMantissa(m => m << 1n, -1, (m, min) => m >= min)

const decreaseMantissa = normalizeMantissa(m => m >> 1n, +1, (m, max) => m < max)

/** @type {(base: bigint) => (exp: number) => bigint} */
const pow = base => exp => base ** BigInt(exp)

const pow5 = pow(5n)

/** @type {(_: BigFloat) => (mul: bigint) => BigFloat} */
export const multiply = ([m, e]) => mul => [m * mul, e]

/** @type {(_: BigFloat) => (div: bigint) => _BigFloatWithRemainder} */
const divide = ([m, e]) => div => [[m / div, e], m % div]

/**
 * Runs `f` on the magnitude `[abs(m), e]` and restores the sign of `m` on the
 * result: operations on signed mantissas factor through the magnitude.
 *
 * @type {(m: bigint, e: number) => (f: (magnitude: BigFloat) => BigFloat) => BigFloat}
 */
const withSign = (m, e) => f => multiply(f([abs(m), e]))(BigInt(sign(m)))

/**
 * Rounds a magnitude and its division remainder to a 53-bit mantissa,
 * half-to-even, restoring the sign of `m` on the result.
 *
 * Rounding up can carry out of 53 bits: when the reduced mantissa is
 * `2^53 - 1`, adding the dropped bit back gives exactly `2^53`, one bit wider
 * than this function is named for. `decreaseMantissa` re-normalizes that case
 * back into range; the carried value is exactly `2^53`, whose dropped bit is
 * `0`, so shifting it needs no second rounding decision and the value is
 * unchanged.
 *
 * @type {(_: _BigFloatWithRemainder) => BigFloat}
 */
const round53 = ([[m, e], r]) =>
    withSign(m, e)(([mAbs]) => {
        const [m54, e54] = decreaseMantissa([mAbs, e])(twoPow54)
        const o54 = m54 & 1n
        const m53 = m54 >> 1n
        const e53 = e54 + 1
        const up = o54 === 1n && r === 0n && mAbs === m54 >> BigInt(e - e54)
            ? m53 & 1n
            : o54
        return decreaseMantissa([m53 + up, e53])(twoPow53)
    })

/**
 * Converts a decimal `BigFloat` to a binary one, rounding the mantissa
 * half-to-even.
 *
 * The result is the IEEE-754 binary64 significand of the input: the mantissa
 * magnitude is always strictly below `2^53`, including when rounding carries
 * (see `round53`). A zero input maps to `[0n, 0]`.
 *
 * @type {(dec: BigFloat) => BigFloat}
 */
export const decToBin = dec => {
    if (dec[0] === 0n) {
        return [0n, 0]
    }
    if (dec[1] >= 0) {
        /** @type {BigFloat} */
        const bin = [dec[0] * pow5(dec[1]), dec[1]]
        const inc = increaseMantissa(bin)(twoPow53)
        return round53([inc, 0n])
    }
    const p = pow5(-dec[1])
    const [m, e] = increaseMantissa(dec)(p * twoPow53)
    return withSign(m, e)(magnitude => round53(divide(magnitude)(p)))
}

export const proof = {
    // normalizeMantissa guards against zero mantissa to prevent an infinite loop;
    // this path is unreachable through decToBin (which returns early for 0n),
    // so we exercise it here where the private helper is in scope.
    normalizeMantissaZero: () => { increaseMantissa([0n, 5])(1n) }
}
