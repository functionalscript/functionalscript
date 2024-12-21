import * as bi from '../bigint/module.f.ts'
const { abs, sign } = bi

export type BigFloat = readonly[bigint,number]

type BigFloatWithRemainder = readonly[BigFloat,bigint]

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
const twoPow54 = 0b0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

const increaseMantissa
    : (value: BigFloat) => (min: bigint) => BigFloat
    = ([m, e]) => min => {
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

const decreaseMantissa
    : (value: BigFloat) => (max: bigint) => BigFloat
    = ([m, e]) => max => {
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

const pow
    : (base: bigint) => (exp: number) => bigint
    = base => exp => base ** BigInt(exp)

const pow5 = pow(5n)

export const multiply
    : (b: BigFloat) => (mul: bigint) => BigFloat
    = ([m, e]) => mul => [m * mul, e]

const divide
    : (b: BigFloat) => (div: bigint) => BigFloatWithRemainder
    = ([m, e]) => div => [[m / div, e], m % div]

const round53
    : (b: BigFloatWithRemainder) => BigFloat
    = ([[m, e], r]) => {
    const mabs = abs(m)
    const s = BigInt(sign(m))
    const [m54, e54] = decreaseMantissa([mabs, e])(twoPow54)
    const o54 = m54 & 1n
    const m53 = m54 >> 1n
    const e53 = e54 + 1
    if (o54 === 1n && r === 0n && mabs === m54 >> BigInt(e - e54)) {
        const odd = m53 & 1n
        return multiply([m53 + odd, e53])(s)
    }
    return multiply([m53 + o54, e53])(s)
}

export const decToBin
    : (dec: BigFloat) => BigFloat
    = dec => {
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
    const mAbs = abs(m)
    const s = BigInt(sign(m))
    const qr = divide([mAbs, e])(p)
    const r53 = round53(qr)
    return multiply(r53)(s)
}
