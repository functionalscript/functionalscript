const op = require('../types/function/operator/module.f.cjs')

/** @typedef {op.Reduce<bigint>} Reduce */

/** @typedef {op.Unary<bigint, bigint>} Unary*/

/**
 * @typedef {{
 *  readonly p: bigint
 *  readonly a: bigint
 *  readonly b: bigint
 *  readonly g: readonly[bigint, bigint]
 *  readonly n: bigint
 * }} Curve
 */

/**
 * @typedef {{
 *  readonly middle: bigint
 *  readonly max: bigint
 *  readonly neg: Unary
 *  readonly sub: Reduce
 *  readonly add: Reduce
 *  readonly abs: Unary
 *  readonly mul: Reduce
 *  readonly reciprocal: Unary
 *  readonly div: Reduce
 *  readonly pow: Reduce
 *  readonly sqrt: (a: bigint) => bigint|null
 *  readonly pow2: Unary
 *  readonly pow3: Unary
 * }} PrimeField
 */

/** @type {(p: bigint) => PrimeField} */
const prime_field = p => {
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
    if ((p & 3n) !== 3n) { throw 'sqrt' }
    const sqrt_k = (p + 1n) >> 2n
    /** @type {Unary} */
    const pow2 = a => mul(a)(a)
    /** @type {Reduce} */
    const pow = a => n => {
        let result = 1n
        while (true) {
            if ((n & 1n) === 1n) {
                result = mul(result)(a)
            }
            n >>= 1n
            if (n === 0n) {
                return result
            }
            a = pow2(a)
        }
    }
    return {
        middle,
        max: p - 1n,
        neg: a => a === 0n ? 0n : p - a,
        sub,
        add: a => b => {
            const r = a + b
            return r < p ? r : r - p
        },
        abs: a => middle < a ? p - a : a,
        mul,
        reciprocal,
        div: a => b => mul(a)(reciprocal(b)),
        pow,
        sqrt: a => {
            const result = pow(a)(sqrt_k)
            return mul(result)(result) === a ? result : null
        },
        pow2,
        pow3: a => mul(a)(pow2(a))
    }
}

module.exports = {
    prime_field
}
