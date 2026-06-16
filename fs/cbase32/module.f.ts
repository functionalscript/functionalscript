/**
 * Content-addressable Base32 encoding and decoding helpers.
 *
 * @module
 */
import { msb, lsb, type Vec, length, vec, empty } from "../types/bit_vec/module.f.ts"
import type { Nullable } from "../types/nullable/module.f.ts"
import { baseN } from "../base_n/module.f.ts"

//                         0123456789abcdef
const m = '0123456789abcdefghjkmnpqrstvwxyz'

const { concat } = msb

const popBack1 = lsb.popFront(1n)

const normalizeChar = (c: string): string => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        case 'l': { return '1' }
        case 'o': { return '0' }
        default: { return lower }
    }
}

const codec = baseN(5n, m, normalizeChar)

export const vec5xToCBase32: (v: Vec) => string = codec.vecToString

export const cBase32ToVec5x: (s: string) => Nullable<Vec> = codec.stringToVec

export const vecToCBase32 = (v: Vec): string => {
    const len = length(v)
    const extraLen = 5n - len % 5n
    const last = 1n << (extraLen - 1n)
    const padded = concat(v)(vec(extraLen)(last))
    return vec5xToCBase32(padded)
}

export const cBase32ToVec = (s: string): Nullable<Vec> => {
    let v = cBase32ToVec5x(s)
    if (v === null) { return null }
    // Strip the padding: trailing zeros up to and including the sentinel `1` bit.
    // A string with no sentinel — only zero symbols (`0`/`o`), or empty — exhausts
    // to `empty` and is rejected as `null` rather than looping forever.
    while (v !== empty) {
        const [last, rest] = popBack1(v)
        v = rest
        if (last === 1n) { return v }
    }
    return null
}
