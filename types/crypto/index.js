/**
 * @typedef {{
 *  readonly input: number[]
 *  readonly length: number
 * }} HashInput
 */

/**
 * @typedef {readonly[number, number, number, number, number, number, number, number]} HashOutput8
 */

/** @type  {(input: number) => (pos: number) => number} */
const appendOne = input => pos =>
{
    return input | (1 << 31 - pos)
}

/** @type  {(input: number) => (pos: number) => number} */
const unsignedMod = a => b =>
{
    return (a % b + b) % b
}

/** @type  {(input: number[]) => (length: number) => readonly number[]} */
const padding = input => length =>
{
    const appendBlockIndex = Math.floor(length / 32)
    //console.log(appendBlockIndex)
    const k = unsignedMod(447 - length)(512)
    //console.log(k)
    const outputLength = length + k + 65
    //console.log(outputLength)
    let o = new Array(outputLength / 32)
    //console.log(o.length)
    /** @type {(i: number) => number} */
    const f = i => {
        if (i < appendBlockIndex)
            return input[i];
        else if (i === appendBlockIndex)
            return appendBlockIndex >= input.length ? 0x80000000 : appendOne(input[appendBlockIndex])(length % 32);
        else if (i === o.length - 2)
            return Math.floor(length / 4294967296)
        else if (i === o.length - 1)
            return length % 4294967296
        else
            return 0
    }
    for(let i = 0; i < o.length; i++)
    {
        o[i] = f(i)
    }
    return o;
}

/** @type {(x: number) => (y: number) => (z: number) => number} */
const ch = x => y => z =>
{
    return x & y ^ ~x & z
}

/** @type {(x: number) => (y: number) => (z: number) => number} */
const maj = x => y => z =>
{
    return x & y ^ x & z ^ y & z
}

/** @type {(n: number) => (d: number) => number} */
const rotr = n => d =>
{
    return n >>> d | n << (32-d)
}

/** @type {(n: number) => (d: number) => number} */
const shr = n => d =>
{
    return n >>> d
}

/** @type {(x: number) => number} */
const bsig0 = x =>
{
    return rotr(x)(2) ^ rotr(x)(13) ^ rotr(x)(22)
}

/** @type {(x: number) => number} */
const bsig1 = x =>
{
    return rotr(x)(6) ^ rotr(x)(11) ^ rotr(x)(25)
}

/** @type {(x: number) => number} */
const ssig0 = x =>
{
    return rotr(x)(7) ^ rotr(x)(18) ^ shr(x)(3)
}

/** @type {(x: number) => number} */
const ssig1 = x =>
{
    return rotr(x)(17) ^ rotr(x)(19) ^ shr(x)(10)
}

/** @type {(x: number) => number} */
const mod2pow32 = x =>
{
    return x % 4294967296
}

/** @type {(input: number[]) => (length: number) => HashOutput8} */
const computeSha256 = input => length =>
{
    const padded = padding(input)(length)

    let h0 = 0x6a09e667
    let h1 = 0xbb67ae85
    let h2 = 0x3c6ef372
    let h3 = 0xa54ff53a
    let h4 = 0x510e527f
    let h5 = 0x9b05688c
    let h6 = 0x1f83d9ab
    let h7 = 0x5be0cd19

    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    // /** @type {(a: number) => string} */
    // const toHexString = x =>
    // {
    //     return x >= 0 ? x.toString(16).padStart(8, '0') : (x + 0x100000000).toString(16).padStart(8, '0')
    // }

    let w = new Array(64)
    const chunkCount = padded.length / 16
    for(let i = 0; i < chunkCount; i++)
    {
        for(let t = 0; t < 16; t++)
        {
            w[t] = padded[t + i * 16]
        }

        for(let t = 16; t < 64; t++)
        {
            w[t] = mod2pow32(ssig1(w[t - 2]) + w[t - 7] + ssig0(w[t-15]) + w[t - 16])
        }

        //console.log(w.map(toHexString))

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
            let t1 = mod2pow32(h + bsig1(e) + ch(e)(f)(g) + k[t] + w[t])
            let t2 = mod2pow32(bsig0(a) + maj(a)(b)(c))
            h = g
            g = f
            f = e
            e = mod2pow32(d + t1)
            d = c
            c = b
            b = a
            a = mod2pow32(t1 + t2)
        }

        h0 = mod2pow32(h0 + a)
        h1 = mod2pow32(h1 + b)
        h2 = mod2pow32(h2+ c)
        h3 = mod2pow32(h3 + d)
        h4 = mod2pow32(h4 + e)
        h5 = mod2pow32(h5 + f)
        h6 = mod2pow32(h6 + g)
        h7 = mod2pow32(h7 + h)
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7]
}

module.exports = {
    /** @readonly */
    padding,
    /** @readonly */
    computeSha256,
}
