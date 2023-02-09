const compare = require('../function/compare/module.f.cjs')
const { abs, sign } = require('../bigint/module.f.cjs')

/**
 * @typedef {{
*  readonly mantissa: bigint
*  readonly exp: number
* }} BigFloat
*/

const minSignificand = 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/** @type {(decFloat: BigFloat) => (min: bigint) => BigFloat} */
const increaseMantissa = value => min => {
    let m = abs(value.mantissa)
    let e = value.exp
    if (m === 0n) {
        return value
    }
    while (true) {
        if (m >= min) {
            return { mantissa: BigInt(sign(value.mantissa)) * m, exp: e}
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

/** @type {(dec: BigFloat) => BigFloat} */
const decToBin = dec => {
    if (dec.mantissa === 0n) {
        return { mantissa: 0n, exp: 0}
    }
    if (dec.exp >= 0) {
        const bin = { mantissa: dec.mantissa * pow5(dec.exp), exp: dec.exp }
        return increaseMantissa(bin)(minSignificand)
    }
    const p = pow5(-dec.exp)
    const inc = increaseMantissa(dec)(p * minSignificand)
    return { mantissa: inc.mantissa / p, exp: inc.exp }
}

module.exports = {
    /** @readonly */
    decToBin,
}