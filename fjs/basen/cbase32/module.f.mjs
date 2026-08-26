/**
 * Content-addressable Base32 encoding and decoding helpers.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { msb, lsb, length, vec, empty } from '../../types/bit_vec/module.f.mjs'
import { baseN } from '../module.f.mjs'

//                         0123456789abcdef
const m = '0123456789abcdefghjkmnpqrstvwxyz'

const { concat } = msb

const popBack1 = lsb.popFront(1n)

/** @type {(c: string) => string} */
const normalizeChar = c => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        case 'l': { return '1' }
        case 'o': { return '0' }
        default: { return lower }
    }
}

const codec = baseN(5n, m, normalizeChar)

/** @type {(v: Vec) => string} */
export const vec5xToCBase32 = codec.vecToString

/** @type {(s: string) => Nullable<Vec>} */
export const cBase32ToVec5x = codec.stringToVec

/** @type {(v: Vec) => string} */
export const vecToCBase32 = v => {
    const len = length(v)
    const extraLen = 5n - len % 5n
    const last = 1n << (extraLen - 1n)
    const padded = concat(v)(vec(extraLen)(last))
    return vec5xToCBase32(padded)
}

/** @type {(s: string) => Nullable<Vec>} */
export const cBase32ToVec = s => {
    // The encoder always puts the sentinel in the final 5-bit character.
    // Decode that character separately so its padding never makes the main
    // vector exceed `maxLength` before the padding is stripped.
    const head = cBase32ToVec5x(s.slice(0, -1))
    if (head === null) { return null }
    let tail = cBase32ToVec5x(s.slice(-1))
    if (tail === null) { return null }
    while (tail !== empty) {
        const [last, rest] = popBack1(tail)
        tail = rest
        if (last === 1n) { return concat(head)(rest) }
    }
    return null
}
