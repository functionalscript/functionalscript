/**
 * Prime field arithmetic over `bigint`: `prime_field(p)` builds a `PrimeField`
 * with negation, addition, subtraction, multiplication, division via modular
 * inverse, and exponentiation; `sqrt` returns a square-root function when
 * `p % 4 === 3`.
 *
 * @module
 */
import type { Unary, Reduce } from '../bigint/module.f.ts'
import { repeat } from '../monoid/module.f.ts'

/**
 * A type representing a prime field and its associated operations.
 */
export type PrimeField = {
    readonly p: bigint
    readonly middle: bigint
    readonly max: bigint
    readonly neg: Unary
    readonly sub: Reduce
    readonly add: Reduce
    readonly abs: Unary
    readonly mul: Reduce
    readonly reciprocal: Unary
    readonly div: Reduce
    readonly pow: Reduce
    readonly pow2: Unary
    readonly pow3: Unary
    /** Reduces an arbitrary `bigint` into `[0, p)`. */
    readonly reduce: Unary
    /** Euler criterion: `true` when `x` is a quadratic residue mod `p`. */
    readonly quadRes: (x: bigint) => boolean
}

/**
 * Creates a prime field with the specified prime modulus and associated operations.
 *
 * @param p - A prime number to define the field.
 * @returns The prime field object.
 */
export const prime_field = (p: bigint): PrimeField => {
    const sub: Reduce = a => b => {
        const r = a - b
        return r < 0 ? r + p : r
    }
    const mul: Reduce = a => b => a * b % p
    const reciprocal: Unary = a => {
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
    const pow2: Unary = a => mul(a)(a)
    const pow: Reduce = repeat({ identity: 1n, operation: mul })
    const add: Reduce = a => b => {
        const r = a + b
        return r < p ? r : r - p
    }
    const red: Unary = x => {
        const r = x % p
        return r < 0n ? add(p)(r) : r
    }
    const half = (p - 1n) / 2n
    const qr = (x: bigint): boolean => pow(half)(red(x)) === 1n
    return {
        p,
        middle,
        max: p - 1n,
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
        reduce: red,
        quadRes: qr,
    }
}

/**
 * Computes the square root of a number in a prime field.
 *
 * @throws If the prime modulus `p` does not satisfy `p % 4 == 3`.
 *
 * @example
 *
 * ```js
 * const field = prime_field(7n);
 * const root = sqrt(field)(4n);
 * if (root !== 2n) { throw root }
 * ```
 */
export const sqrt = ({p, pow, pow2 }: PrimeField): (a: bigint) => bigint|null => {
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
 */
export const modSqrt = (field: PrimeField): Unary => {
    const { neg, reduce } = field
    const sqrt_p = sqrt(field)
    return x => {
        const v = reduce(x)
        const r = sqrt_p(v)
        if (r !== null) {
            return r
        }
        const s = sqrt_p(neg(v))
        if (s === null) {
            throw 'modSqrt'
        }
        return s
    }
}
