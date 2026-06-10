/**
 * Big-float helpers built from bigint mantissa and exponent parts.
 *
 * @module
 */
import { abs, sign } from '../bigint/module.f.ts'

export type BigFloat = readonly[bigint,number]

type BigFloatWithRemainder = readonly[BigFloat,bigint]

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
const twoPow54 = 0b0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/**
 * Shifts the mantissa magnitude one bit at a time, compensating the exponent,
 * until `done(magnitude, bound)` holds; the sign is restored on return.
 * A zero mantissa is returned unchanged: it can never satisfy a lower bound,
 * so shifting it would not terminate.
 */
const normalizeMantissa =
    (shift: (m: bigint) => bigint, de: number, done: (m: bigint, bound: bigint) => boolean) =>
    ([m, e]: BigFloat) => (bound: bigint): BigFloat => {
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

const pow = (base: bigint) => (exp: number) => base ** BigInt(exp)

const pow5 = pow(5n)

export const multiply = ([m, e]: BigFloat) => (mul: bigint): BigFloat =>
    [m * mul, e]

const divide = ([m, e]: BigFloat) => (div: bigint): BigFloatWithRemainder =>
    [[m / div, e], m % div]

/**
 * Runs `f` on the magnitude `[abs(m), e]` and restores the sign of `m` on the
 * result: operations on signed mantissas factor through the magnitude.
 */
const withSign = (m: bigint, e: number) => (f: (magnitude: BigFloat) => BigFloat): BigFloat =>
    multiply(f([abs(m), e]))(BigInt(sign(m)))

const round53 = ([[m, e], r]: BigFloatWithRemainder): BigFloat =>
    withSign(m, e)(([mAbs]) => {
        const [m54, e54] = decreaseMantissa([mAbs, e])(twoPow54)
        const o54 = m54 & 1n
        const m53 = m54 >> 1n
        const e53 = e54 + 1
        if (o54 === 1n && r === 0n && mAbs === m54 >> BigInt(e - e54)) {
            const odd = m53 & 1n
            return [m53 + odd, e53]
        }
        return [m53 + o54, e53]
    })

export const decToBin = (dec: BigFloat): BigFloat => {
    if (dec[0] === 0n) {
        return [0n, 0]
    }
    if (dec[1] >= 0) {
        const bin: BigFloat = [dec[0] * pow5(dec[1]), dec[1]]
        const inc = increaseMantissa(bin)(twoPow53)
        return round53([inc, 0n])
    }
    const p = pow5(-dec[1])
    const [m, e] = increaseMantissa(dec)(p * twoPow53)
    return withSign(m, e)(magnitude => round53(divide(magnitude)(p)))
}
