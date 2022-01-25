/**
 * @typedef {{
 *  readonly f: (i: number) => number
 *  readonly length: number
 * }} HashInput
 */

/** @typedef {Int32Array} Hash8 */

/** @typedef {Int32Array} Array16 */

/** @type {(input: number) => (pos: number) => number} */
const appendOne = input => pos => input | (1 << 31 - pos)

/** @type {(input: number) => (pos: number) => number} */
const mod = a => b => (a % b + b) % b

/** @type  {(input: readonly number[]) => (bits: number) => HashInput} */
const padding = input => bitsCount => {
    const appendBlockIndex = (bitsCount / 32) | 0
    const length = (bitsCount + mod(447 - bitsCount)(512) + 65) / 32
    /** @type {(i: number) => number} */
    const f = i =>
        i < appendBlockIndex ?
            input[i] :
            i === appendBlockIndex ?
                (appendBlockIndex >= input.length ? 0x8000_0000 : appendOne(input[appendBlockIndex])(bitsCount % 32)) :
                i === length - 2 ? (bitsCount / 0x1_0000_0000) | 0 :
                    i === length - 1 ? bitsCount % 0x1_0000_0000 : 0
    return ({ f, length })
}

/** @type {(d: number) => (n: number) => number} */
const rotr = d => {
    const r = 32 - d
    return n => n >>> d | n << r
}

/** @type {(x: number) => (y: number) => (z: number) => number} */
const ch = x => y => z => x & y ^ ~x & z

/** @type {(x: number) => (y: number) => (z: number) => number} */
const maj = x => y => z => x & y ^ x & z ^ y & z

/** @type {(d: number) => (n: number) => number} */
const shr = d => n => n >>> d

/** @type {(a: number) => (b: number) => (c: number) => (x: number) => number} */
const bigSigma = a => b => c => {
    const ra = rotr(a)
    const rb = rotr(b)
    const rc = rotr(c)
    return x => ra(x) ^ rb(x) ^ rc(x)
}

const bigSigma0 = bigSigma(2)(13)(22)

const bigSigma1 = bigSigma(6)(11)(25)

/** @type {(a: number) => (b: number) => (c: number) => (x: number) => number} */
const smallSigma = a => b => c => {
    const ra = rotr(a)
    const rb = rotr(b)
    const sc = shr(c)
    return x => ra(x) ^ rb(x) ^ sc(x)
}

const smallSigma0 = smallSigma(7)(18)(3)

const smallSigma1 = smallSigma(17)(19)(10)

/** @type {Hash8} */
const init256 = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])

/** @type {(input: readonly number[]) => (bitsCount: number) => Hash8} */
const computeSha256 = input => bitsCount => compute(input)(bitsCount)(init256)

/** @type {Hash8} */
const init224 = new Int32Array([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4])

const k = [
    new Int32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174]),
    new Int32Array([
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967]),
    new Int32Array([
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070]),
    new Int32Array([
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]),
];

/** @type {(input: readonly number[]) => (bitsCount: number) => Hash8} */
const computeSha224 = input => bitsCount => compute(input)(bitsCount)(init224)

/** @type {(input: Array16) => Array16} */
const nextW = w => {
    for (let t = 0; t < 16; t++) {
        w[t] = smallSigma1(w[(t + 14) & 0xF]) + w[(t + 9) & 0xF] + smallSigma0(w[(t + 1) & 0xF]) + w[t]
    }
    return w
}

/** @type {(init: Hash8) => (data: Array16) => Hash8} */
const compress = init => data => {
    let w = new Int32Array(16)
    for (let t = 0; t < 16; t++) {
        w[t] = data[t]
    }

    let a = init[0]
    let b = init[1]
    let c = init[2]
    let d = init[3]
    let e = init[4]
    let f = init[5]
    let g = init[6]
    let h = init[7]

    for (let i = 0; i < 4; ++i) {
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
        w = nextW(w)
    }

    return new Int32Array([
        init[0] + a,
        init[1] + b,
        init[2] + c,
        init[3] + d,
        init[4] + e,
        init[5] + f,
        init[6] + g,
        init[7] + h,
    ])
}

/** @type {(input: readonly number[]) => (bitsCount: number) => (init: Hash8) => Hash8} */
const compute = input => bitsCount => init => {
    const { f, length } = padding(input)(bitsCount)

    let result = init

    const chunkCount = length / 16
    for (let i = 0; i < chunkCount; i++) {
        const s = i * 16
        result = compress(result)(new Int32Array([
            f(s + 0), f(s + 1), f(s + 2), f(s + 3), f(s + 4), f(s + 5), f(s + 6), f(s + 7),
            f(s + 8), f(s + 9), f(s + 10), f(s + 11), f(s + 12), f(s + 13), f(s + 14), f(s + 15)]))
    }

    return result
}

module.exports = {
    /** @readonly */
    padding,
    /** @readonly */
    computeSha256,
    /** @readonly */
    computeSha224
}
