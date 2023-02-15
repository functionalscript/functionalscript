const compare = require('../function/compare/module.f.cjs')
const { abs, sign } = require('../bigint/module.f.cjs')

/** @typedef {readonly[bigint,number]} BigFloat */

const minSignificand = 0b10_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/** @type {(value: BigFloat) => (min: bigint) => BigFloat} */
const increaseMantissa = ([m,e]) => min => {
    if (m === 0n) {
        return [m,e]
    }
    const s = sign(m)
    m = abs(m)
    while (true) {
        if (m >= min) {
            return [BigInt(s) * m, e]
        }
        m = m << 1n
        e--
    }
}

/** @type {(base: bigint) => (exp: number) => bigint} */
const pow = base => exp => base ** BigInt(exp)

const pow5 = pow(5n)

/** @type {(dec: BigFloat) => BigFloat} */
const decToBin = dec => {
    if (dec[0] === 0n) {
        return [0n, 0]
    }
    if (dec[1] >= 0) {
        /** @type {BigFloat} */
        const bin = [dec[0] * pow5(dec[1]), dec[1]]
        return increaseMantissa(bin)(minSignificand)
    }
    const p = pow5(-dec[1])
    const inc = increaseMantissa(dec)(p * minSignificand)
    return [inc[0] / p, inc[1]]
}

module.exports = {
    /** @readonly */
    decToBin,
}