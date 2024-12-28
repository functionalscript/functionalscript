import { abs, sign } from '../bigint/module.f.ts'

export type BigFloat = readonly[bigint,number]

type BigFloatWithRemainder = readonly[BigFloat,bigint]

const twoPow53 = 0b0010_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n
const twoPow54 = 0b0100_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

const increaseMantissa = ([m, e]: BigFloat) => (min: bigint): BigFloat => {
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

const decreaseMantissa = ([m, e]: BigFloat) => (max: bigint): BigFloat => {
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

const pow = (base: bigint) => (exp: number) => base ** BigInt(exp)

const pow5 = pow(5n)

export const multiply = ([m, e]: BigFloat) => (mul: bigint): BigFloat =>
    [m * mul, e]

const divide = ([m, e]: BigFloat) => (div: bigint): BigFloatWithRemainder =>
    [[m / div, e], m % div]

const round53 = ([[m, e], r]: BigFloatWithRemainder): BigFloat => {
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

export const decToBin = (dec: BigFloat): BigFloat => {
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
