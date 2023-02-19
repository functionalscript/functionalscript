const compare = require('../function/compare/module.f.cjs')
const { abs, sign } = require('../bigint/module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')

/** @typedef {readonly[bigint,number]} BigFloat */

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
const twoPow54 = 0b0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

/** @type {(value: BigFloat) => (min: bigint) => BigFloat} */
const increaseMantissa = ([m, e]) => min => {
    if (m === 0n) {
        return [m, e]
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

/** @type {(value: BigFloat) => (max: bigint) => BigFloat} */
const decreaseMantissa = ([m, e]) => max => {
    if (m === 0n) {
        return [m, e]
    }
    const s = sign(m)
    m = abs(m)
    while (true) {
        if (m < max) {
            return [BigInt(s) * m, e]
        }
        m = m >> 1n
        e++
    }
}

/** @type {(base: bigint) => (exp: number) => bigint} */
const pow = base => exp => base ** BigInt(exp)

const pow5 = pow(5n)

/** @type {(div: BigFloat) => (p: bigint) => BigFloat} */
const divide = ([m, e]) => div => {
    const mabs = abs(m)
    const q = mabs / div
    const s = BigInt(sign(m))
    const [q53, e53] = decreaseMantissa([q, e])(twoPow54)
    const r = q53 & 1n
    const q52 = q53 >> 1n
    const e52 = e53 + 1
    if (r === 1n) {
        const zeroReminder = mabs === q * div
        if (zeroReminder) {
            const noLoss = q === q53 >> BigInt(e - e53)
            if (noLoss) {
                const odd = q52 & 1n
                return [s * (q52 + odd), e52]
            }
        }
    }
    return [s * (q52 + r), e52]
}

/** @type {(dec: BigFloat) => BigFloat} */
const decToBin = dec => {
    if (dec[0] === 0n) {
        return [0n, 0]
    }
    if (dec[1] >= 0) {
        /** @type {BigFloat} */
        const bin = [dec[0] * pow5(dec[1]), dec[1]]
        return divide(increaseMantissa(bin)(twoPow53))(1n)
    }
    const p = pow5(-dec[1])
    const [m, e] = increaseMantissa(dec)(p * twoPow53)
    return divide([m, e])(p)
}

module.exports = {
    /** @readonly */
    decToBin,
}