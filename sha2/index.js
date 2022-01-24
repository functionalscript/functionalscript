/**
 * @typedef {{
 *  readonly f: (i: number) => number
 *  readonly length: number
 * }} HashInput
 */

/**
 * @typedef {Int32Array} Hash8
 */

/** @type {(input: number) => (pos: number) => number} */
const appendOne = input => pos => input | (1 << 31 - pos)

/** @type {(input: number) => (pos: number) => number} */
const mod = a => b => (a % b + b) % b

/** @type  {(input: readonly number[]) => (bits: number) => HashInput} */
const padding = input => bitsCount =>
{
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
    return ({f, length})
}

/** @type {(n: number) => (d: number) => number} */
const rotr = n => d => n >>> d | n << (32 - d)

/** @type {(x: number) => (y: number) => (z: number) => number} */
const ch = x => y => z => x & y ^ ~x & z

/** @type {(x: number) => (y: number) => (z: number) => number} */
const maj = x => y => z => x & y ^ x & z ^ y & z

/** @type {(n: number) => (d: number) => number} */
const shr = n => d => n >>> d

/** @type {(x: number) => number} */
const bsig0 = x => rotr(x)(2) ^ rotr(x)(13) ^ rotr(x)(22)

/** @type {(x: number) => number} */
const bsig1 = x => rotr(x)(6) ^ rotr(x)(11) ^ rotr(x)(25)

/** @type {(x: number) => number} */
const ssig0 = x => rotr(x)(7) ^ rotr(x)(18) ^ shr(x)(3)

/** @type {(x: number) => number} */
const ssig1 = x => rotr(x)(17) ^ rotr(x)(19) ^ shr(x)(10)

/** @type {Hash8} */
const init256 = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])

/** @type {(input: readonly number[]) => (bitsCount: number) => Hash8} */
const computeSha256 = input => bitsCount => compute(input)(bitsCount)(init256)

/** @type {Hash8} */
const init224 = new Int32Array([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4])

const k = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** @type {(input: readonly number[]) => (bitsCount: number) => Hash8} */
const computeSha224 = input => bitsCount => compute(input)(bitsCount)(init224)

/** @type {(input: readonly number[]) => (bitsCount: number) => (init: Hash8) => Hash8} */
const compute = input => bitsCount => init =>
{
    const padded = padding(input)(bitsCount)

    let h0 = init[0]
    let h1 = init[1]
    let h2 = init[2]
    let h3 = init[3]
    let h4 = init[4]
    let h5 = init[5]
    let h6 = init[6]
    let h7 = init[7]

    const chunkCount = padded.length / 16
    for(let i = 0; i < chunkCount; i++)
    {
        const w = new Int32Array(64)
        for(let t = 0; t < 16; t++)
        {
            w[t] = padded.f(t + i * 16)
        }

        for(let t = 16; t < 64; t++)
        {
            w[t] = (ssig1(w[t - 2]) + w[t - 7] + ssig0(w[t-15]) + w[t - 16]) | 0
        }

        let a = h0
        let b = h1
        let c = h2
        let d = h3
        let e = h4
        let f = h5
        let g = h6
        let h = h7

        for(let t = 0; t < 64; t++)
        {
            let t1 = (h + bsig1(e) + ch(e)(f)(g) + k[t] + w[t]) | 0
            let t2 = (bsig0(a) + maj(a)(b)(c)) | 0
            h = g
            g = f
            f = e
            e = (d + t1) | 0
            d = c
            c = b
            b = a
            a = (t1 + t2) | 0
        }

        h0 = (h0 + a) | 0
        h1 = (h1 + b) | 0
        h2 = (h2 + c) | 0
        h3 = (h3 + d) | 0
        h4 = (h4 + e) | 0
        h5 = (h5 + f) | 0
        h6 = (h6 + g) | 0
        h7 = (h7 + h) | 0
    }

    return new Int32Array([h0, h1, h2, h3, h4, h5, h6, h7])
}

module.exports = {
    /** @readonly */
    padding,
    /** @readonly */
    computeSha256,
    /** @readonly */
    computeSha224
}
