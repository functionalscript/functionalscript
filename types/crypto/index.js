const { todo } = require("../../dev")

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

/** @type  {(input: number[]) => (length: number) => readonly number[]} */
const padding = input => length =>
{
    const appendBlockIndex = Math.floor(length / 32)
    //console.log(appendBlockIndex)
    const k = (447 - length) % 512
    //console.log(k)
    const outputLength = length + k + 65
    //console.log(outputLength)
    let o = new Array(outputLength / 32)
    //console.log(o.length)
    for(var i = 0; i < o.length; i++)
    {
        if (i < appendBlockIndex)
            o[i] = input[i];
        else if (i == appendBlockIndex)
            o[i] = appendBlockIndex >= input.length ? 0x80000000 : appendOne(input[appendBlockIndex])(length % 32);
        else if (i == o.length - 2)
            o[i] = Math.floor(length / 4294967296)
        else if (i == o.length - 1)
            o[i] = length % 4294967296
        else
            o[i] = 0
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
    return todo()
}

/** @type {(n: number) => (d: number) => number} */
const shr = n => d =>
{
    return todo()
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

/** @type {(input: number[]) => (length: number) => HashOutput8} */
const computeSha256 = input => length =>
{
    const padded = padding(input)(length)
    
    const h0 = 0x6a09e667;
    const h1 = 0xbb67ae85;
    const h2 = 0x3c6ef372;
    const h3 = 0xa54ff53a;
    const h4 = 0x510e527f;
    const h5 = 0x9b05688c;
    const h6 = 0x1f83d9ab;
    const h7 = 0x5be0cd19;

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

    return todo()
}

module.exports = {
    /** @readonly */
    padding,
    /** @readonly */
    computeSha256,
}
