/**
 * Content-addressable Base32 encoding and decoding helpers.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

import { msb, padLastBlockMsb, unpadMsb } from '../../types/bit_vec/module.f.mjs'
import { baseN } from '../module.f.mjs'

//                         0123456789abcdef
const m = '0123456789abcdefghjkmnpqrstvwxyz'

const { tryConcat } = msb

const pad5 = padLastBlockMsb(5n)

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

/**
 * `v` in CBase32: its bits, a terminator — a `1`, then zeros to a whole
 * character — and five bits a character. Every `v` gets a terminator, so an
 * empty one is `g` and a multiple of five bits ends with `g` too.
 *
 * The whole characters and the last are encoded apart, so no vector past `v`
 * is built and the largest bit vector encodes on every runtime.
 *
 * @type {(v: Vec) => string}
 */
export const vecToCBase32 = v => {
    const [whole, last] = pad5(v)
    return vec5xToCBase32(whole) + vec5xToCBase32(last)
}

/**
 * The bits `s` encodes, or `null` when it does not decode: a character not in
 * the alphabet, no terminator, or more than the largest bit vector. Zero
 * characters after the terminator are accepted, so `g0` decodes as `g`
 * does.
 *
 * @type {(s: string) => Nullable<Vec>}
 */
export const cBase32ToVec = s => {
    // Locate the terminator from the end one character at a time. This
    // preserves accepted non-canonical spellings with trailing zero characters
    // without ever materialising their padded body as one oversized vector.
    for (let i = s.length - 1; i >= 0; i -= 1) {
        const last = cBase32ToVec5x(s[i])
        if (last === null) { return null }
        const tail = unpadMsb(last)
        if (tail !== null) {
            const head = cBase32ToVec5x(s.slice(0, i))
            return head === null ? null : tryConcat(head)(tail)
        }
    }
    return null
}

/**
 * The canonical spelling of a cBase32 string, or `null` when it does not
 * decode. {@link cBase32ToVec} accepts more than one spelling of the same
 * value — any case, and the `i`/`l`/`o` aliases — so two spellings compare
 * equal as strings only once both are re-encoded through this.
 *
 * @type {(s: string) => Nullable<string>}
 */
export const canonicalCBase32 = s => {
    const v = cBase32ToVec(s)
    return v === null ? null : vecToCBase32(v)
}
