import type * as array from '../../types/array/module.f.ts'

type HashInput = {
    readonly f: (i: number) => number
    readonly length: number
}

type Hash8 = array.Array8<number>

type Array16 = array.Array16<number>

const appendOneWithZeros = (input: number) => (pos: number) =>
    (input >> pos << pos) | (1 << pos)

const mod = (a: number) => (b: number) => (a % b + b) % b

export const padding = (input: readonly number[]) => (bitsCount: number): HashInput => {
    const appendBlockIndex = (bitsCount / 32) | 0
    const length = (bitsCount + mod(447 - bitsCount)(512) + 65) / 32
    const f
        : (i: number) => number
        = i => {
        if (i < appendBlockIndex) { return input[i] }
        if (i === appendBlockIndex) {
            return appendBlockIndex >= input.length ? 0x8000_0000 : appendOneWithZeros(input[appendBlockIndex])(31 - bitsCount % 32)
        }
        if (i === length - 2) { return (bitsCount / 0x1_0000_0000) | 0 }
        if (i === length - 1) { return bitsCount % 0x1_0000_0000 }
        return 0
    }
    return ({ f, length })
}

const rotr = (d: number) => {
    const r = 32 - d
    return (n: number) => n >>> d | n << r
}

const ch = (x: number) => (y: number) => (z: number) => x & y ^ ~x & z

const maj = (x: number) => (y: number) => (z: number) => x & y ^ x & z ^ y & z

const shr = (d: number) => (n: number) => n >>> d

const bigSigma = (a: number) => (b: number) => (c: number) => {
    const ra = rotr(a)
    const rb = rotr(b)
    const rc = rotr(c)
    return (x: number) => ra(x) ^ rb(x) ^ rc(x)
}

const bigSigma0 = bigSigma(2)(13)(22)

const bigSigma1 = bigSigma(6)(11)(25)

const smallSigma = (a: number) => (b: number) => (c: number) => {
    const ra = rotr(a)
    const rb = rotr(b)
    const sc = shr(c)
    return (x:number) => ra(x) ^ rb(x) ^ sc(x)
}

const smallSigma0 = smallSigma(7)(18)(3)

const smallSigma1 = smallSigma(17)(19)(10)

const wi = ([a0, a1, a2, a3]: array.Array4<number>) =>
    (smallSigma1(a0) + a1 + smallSigma0(a2) + a3) | 0

const nextW = ([w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF]: Array16): Array16 => {
    w0 = wi([wE, w9, w1, w0])
    w1 = wi([wF, wA, w2, w1])
    w2 = wi([w0, wB, w3, w2])
    w3 = wi([w1, wC, w4, w3])
    w4 = wi([w2, wD, w5, w4])
    w5 = wi([w3, wE, w6, w5])
    w6 = wi([w4, wF, w7, w6])
    w7 = wi([w5, w0, w8, w7])
    w8 = wi([w6, w1, w9, w8])
    w9 = wi([w7, w2, wA, w9])
    wA = wi([w8, w3, wB, wA])
    wB = wi([w9, w4, wC, wB])
    wC = wi([wA, w5, wD, wC])
    wD = wi([wB, w6, wE, wD])
    wE = wi([wC, w7, wF, wE])
    wF = wi([wD, w8, w0, wF])
    return [w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, wA, wB, wC, wD, wE, wF]
}

const k = [
    [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    ],
    [
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    ],
    [
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    ],
    [
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ],
]

const compress = ([a0, b0, c0, d0, e0, f0, g0, h0]: Hash8) => (data: Array16): Hash8 => {
    let w = data

    let a = a0
    let b = b0
    let c = c0
    let d = d0
    let e = e0
    let f = f0
    let g = g0
    let h = h0

    let i = 0
    while (true) {
        const ki = k[i]
        for (let j = 0; j < 16; ++j) {
            const t1 = h + bigSigma1(e) + ch(e)(f)(g) + ki[j] + w[j]
            const t2 = bigSigma0(a) + maj(a)(b)(c)
            h = g
            g = f
            f = e
            e = (d + t1) | 0
            d = c
            c = b
            b = a
            a = (t1 + t2) | 0
        }
        if (i === 3) { break }
        ++i;
        w = nextW(w)
    }

    return [
        (a0 + a) | 0,
        (b0 + b) | 0,
        (c0 + c) | 0,
        (d0 + d) | 0,
        (e0 + e) | 0,
        (f0 + f) | 0,
        (g0 + g) | 0,
        (h0 + h) | 0,
    ]
}

const compute = (init: Hash8) => (input: readonly number[]) => (bitsCount: number): Hash8 => {
    const { f, length } = padding(input)(bitsCount)

    let result = init

    const chunkCount = length / 16
    for (let i = 0; i < chunkCount; i++) {
        const s = i * 16
        result = compress(result)([
            f(s + 0), f(s + 1), f(s + 2), f(s + 3), f(s + 4), f(s + 5), f(s + 6), f(s + 7),
            f(s + 8), f(s + 9), f(s + 10), f(s + 11), f(s + 12), f(s + 13), f(s + 14), f(s + 15)])
    }

    return result
}

const init256
    : Hash8
    = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

export const computeSha256
    : (input: readonly number[]) => (bitsCount: number) => Hash8
    = compute(init256)

const init224
    : Hash8
    = [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]

export const computeSha224
    : (input: readonly number[]) => (bitsCount: number) => Hash8
    = compute(init224)

export const compress256
    : (data: Array16) => Hash8
    = compress(init256)

export const compress224
    : (data: Array16) => Hash8
    = compress(init224)
