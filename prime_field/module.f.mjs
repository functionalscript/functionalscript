import op from '../types/function/operator/module.f.cjs'
import bi from '../types/bigint/module.f.mjs'
const { scalar_mul } = bi

/** @typedef {op.Reduce<bigint>} Reduce */

/** @typedef {op.Unary<bigint, bigint>} Unary*/

/**
 * @typedef {{
 *  readonly p: bigint
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
    /** @type {Unary} */
    const pow2 = a => mul(a)(a)
    /** @type {Reduce} */
    const pow = scalar_mul({ 0: 1n, add: mul })
    return {
        p,
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
        pow2,
        pow3: a => mul(a)(pow2(a))
    }
}

export default {
    prime_field,
    /** @type {(f: PrimeField) => (a: bigint) => bigint|null} */
    sqrt: ({p, mul, pow }) => {
        if ((p & 3n) !== 3n) { throw 'sqrt' }
        const sqrt_k = (p + 1n) >> 2n
        return a => {
            const result = pow(a)(sqrt_k)
            return mul(result)(result) === a ? result : null
        }
    }
}
