/**
 * Prime field arithmetic over `bigint`: `prime_field(p)` builds a `PrimeField`
 * with negation, addition, subtraction, multiplication, division via modular
 * inverse, and exponentiation; `sqrt` returns a square-root function when
 * `p % 4 === 3`.
 *
 * @module
 *
 * @import { Reduce, Unary } from '../bigint/types.ts'
 * @import { PrimeField } from './types.ts'
 */

import { repeat } from '../../common/monoid/module.f.mjs'
import { assertNotNullish } from '../../asserts/module.f.mjs'

/**
 * Creates a prime field with the specified prime modulus and associated operations.
 *
 * @param {bigint} p A prime number to define the field.
 * @returns {PrimeField} The prime field object.
 */
export const prime_field = p => {
    /** @type {Reduce} */
    const sub = a => b => {
        const r = a - b
        return r < 0 ? r + p : r
    }
    /** @type {Reduce} */
    const mul = a => b => a * b % p
    /** @type {Unary} */
    const reciprocal = a => {
        if (a === 0n) { throw '1/0' }
        let a1 = a
        let a0 = p
        let f0 = 0n
        let f1 = 1n
        while (a1 !== 1n) {
            const q = a0 / a1
            const a2 = a0 % a1
            a0 = a1
            a1 = a2
            const f2 = sub(f0)(mul(f1)(q))
            f0 = f1
            f1 = f2
        }
        return f1
    }
    const middle = p >> 1n
    /** @type {Unary} */
    const pow2 = a => mul(a)(a)
    /** @type {Reduce} */
    const pow = repeat({ identity: 1n, operation: mul })
    /** @type {Reduce} */
    const add = a => b => {
        const r = a + b
        return r < p ? r : r - p
    }
    /** @type {Unary} */
    const reduce = x => {
        const r = x % p
        return r < 0n ? add(p)(r) : r
    }
    const max = p - 1n
    // Euler's exponent is `(p - 1) / 2`; use `max`, not `p`, so `p === 2n`
    // gives exponent `0n` instead of `1n`.
    // 0 is a square mod p; Euler's criterion needs a separate case because 0^e = 0.
    const powHalf = pow(max >> 1n)
    /** @type {(x: bigint) => boolean} */
    const quadRes = x => {
        const v = reduce(x)
        return v === 0n || powHalf(v) === 1n
    }
    return {
        p,
        middle,
        max,
        neg: a => a === 0n ? 0n : p - a,
        sub,
        add,
        abs: a => middle < a ? p - a : a,
        mul,
        reciprocal,
        div: a => b => mul(a)(reciprocal(b)),
        pow,
        pow2,
        pow3: a => mul(a)(pow2(a)),
        reduce,
        quadRes,
    }
}

/**
 * Computes the square root of a number in a prime field.
 *
 * @throws If the prime modulus `p` does not satisfy `p % 4 == 3`.
 *
 * @param {PrimeField} field
 * @returns {(a: bigint) => bigint | null}
 *
 * @example
 *
 * ```js
 * const field = prime_field(7n);
 * const root = sqrt(field)(4n);
 * if (root !== 2n) { throw root }
 * ```
 */
export const sqrt = ({ p, pow, pow2 }) => {
    if ((p & 3n) !== 3n) { throw 'sqrt' }
    const sqrt_k = (p + 1n) >> 2n
    const psk = pow(sqrt_k)
    return a => {
        const result = psk(a)
        return pow2(result) === a ? result : null
    }
}

/**
 * Modular square root mod `p` (`p ≡ 3 (mod 4)`); uses {@link PrimeField.neg} when `x` is not a residue.
 *
 * @param {PrimeField} field
 * @returns {Unary}
 */
export const modSqrt = field => {
    const { neg, reduce } = field
    const sqrt_p = sqrt(field)
    return x => {
        const v = reduce(x)
        const r = sqrt_p(v)
        // For a prime `p ≡ 3 (mod 4)`, `−1` is a non-residue, so exactly one of
        // `±v` is a quadratic residue: if `v` has no root, `neg(v)` must — hence
        // `s` is non-null. `sqrt` already enforces `p ≡ 3 (mod 4)`, but primality
        // is never checked, so the only way to reach `s === null` is a *composite*
        // modulus (where the residue argument breaks).
        return r !== null ? r : assertNotNullish(sqrt_p(neg(v)), 'modSqrt')
    }
}
