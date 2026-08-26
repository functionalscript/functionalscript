/**
 * Content-addressable Base32 encoding and decoding helpers.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { msb, lsb, length, maxLength, vec, empty } from '../../types/bit_vec/module.f.mjs'
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
    // Locate the sentinel from the end one character at a time. This preserves
    // accepted non-canonical spellings with trailing zero characters without
    // ever materialising their padded body as one oversized vector.
    for (let i = s.length - 1; i >= 0; i--) {
        let tail = cBase32ToVec5x(s[i])
        if (tail === null) { return null }
        while (tail !== empty) {
            const [last, rest] = popBack1(tail)
            tail = rest
            if (last === 1n) {
                const head = cBase32ToVec5x(s.slice(0, i))
                if (head === null || length(head) + length(rest) > maxLength) {
                    return null
                }
                return concat(head)(rest)
            }
        }
    }
    return null
}
