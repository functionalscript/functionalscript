const compare = require('../function/compare/module.f.cjs')
const { abs, sign } = require('../bigint/module.f.cjs')
const { todo } = require('../../dev/module.f.cjs')

/** @typedef {readonly[bigint,number]} BigFloat */

/** @typedef {readonly[BigFloat,bigint]} BigFloatWithRemainder */

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

/** @type {(b: BigFloat) => (mul: bigint) => BigFloat} */
const multiply = ([m, e]) => mul => [m * mul, e]

/** @type {(b: BigFloat) => (div: bigint) => BigFloatWithRemainder} */
const divide = ([m, e]) => div => [[m / div, e], m % div]

/** @type {(b: BigFloatWithRemainder) => BigFloat} */
const round52 = ([[m, e], r]) => {
    const mabs = abs(m)
    const s = BigInt(sign(m))
    const [m53, e53] = decreaseMantissa([mabs, e])(twoPow54)
    const o53 = m53 & 1n
    const m52 = m53 >> 1n
    const e52 = e53 + 1
    if (o53 === 1n && r === 0n && mabs === m53 >> BigInt(e - e53)) {
        const odd = m52 & 1n
        return multiply([m52 + odd, e52])(s)
    }
    return multiply([m52 + o53, e52])(s)
}

/** @type {(dec: BigFloat) => BigFloat} */
const decToBin = dec => {
    if (dec[0] === 0n) {
        return [0n, 0]
    }
    if (dec[1] >= 0) {
        /** @type {BigFloat} */
        const bin = [dec[0] * pow5(dec[1]), dec[1]]
        const inc = increaseMantissa(bin)(twoPow53)
        return round52([inc, 0n])
    }
    const p = pow5(-dec[1])
    const [m, e] = increaseMantissa(dec)(p * twoPow53)
    const mAbs = abs(m)
    const s = BigInt(sign(m))
    const qr = divide([mAbs, e])(p)
    const r52 = round52(qr)
    return multiply(r52)(s)
}

module.exports = {
    /** @readonly */
    decToBin,
}