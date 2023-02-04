const { reduce, repeat, fold } = require('../list/module.f.cjs')
const { addition, min: minOp, max: maxOp } = require('../function/operator/module.f.cjs')
const compare = require('../function/compare/module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')
const { unsafeCmp } = compare

/**
 * @typedef {{
*  readonly mantissa: bigint
*  readonly exp: number
* }} Float
*/

const minSignificand = 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
//const minSignificand = 0b10_0000n

const sum = reduce(addition)(0)

const min = reduce(minOp)(null)

const max = reduce(maxOp)(null)

/** @type {(a: number) => (b: number) => compare.Sign} */
const cmp = unsafeCmp

/** @type {(decFloat: Float) => (min: bigint) => Float} */
const increaseMantissa = value => min => {
    let m = value.mantissa
    let e = value.exp
    if (m === 0n) {
        return value
    }
    while (true) {
        if (m >= min) {
            return { mantissa: m, exp: e}
        }
        m = m << 1n
        e--
    }
}

/** @type {(base: bigint) => (exp: number) => bigint} */
const pow = base => exp => {
    let r = 1n
    while (true) {
        if (exp <= 0) {
            return r
        }
        r *= base
        exp--
    }
}

const pow5 = pow(5n)

/** @type {(dec: Float) => Float} */
const decToBin = dec => {
    if (dec.exp >= 0) {
        const bin = { mantissa: dec.mantissa * pow5(dec.exp), exp: dec.exp }
        return increaseMantissa(bin)(minSignificand)
    }
    const p = pow5(-dec.exp)
    const bin = { mantissa: dec.mantissa, exp: dec.exp }
    const inc = increaseMantissa(bin)(p * minSignificand)
    return { mantissa: inc.mantissa / p, exp: inc.exp }
}

module.exports = {
    /** @readonly */
    sum,
    /** @readonly */
    min,
    /** @readonly */
    max,
    /** @readonly */
    cmp,
    /** @readonly */
    decToBin,
}