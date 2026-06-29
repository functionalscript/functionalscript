import { assertEq } from '../asserts/module.f.ts'
import { empty, maxLength, vec, length } from '../types/bit_vec/module.f.ts'
import { baseN } from './module.f.ts'

const hex = baseN(4n, '0123456789abcdef')

const cb32 = baseN(5n, '0123456789abcdefghjkmnpqrstvwxyz', c => {
    const lower = c.toLowerCase()
    switch (lower) {
        case 'i': { return '1' }
        case 'l': { return '1' }
        case 'o': { return '0' }
        default: { return lower }
    }
})

// Sample input for the `big` proof below: 262 144 `f` characters decode into a
// 1 Mibit (`maxLength`) vector.
const bigSampleHex = `f`.repeat(Number(maxLength >> 2n))

export const proof = {
    encodeEmpty: () => {
        const s = hex.vecToString(empty)
        if (s !== '') { throw [s] }
    },
    encodeAligned: () => {
        // Two 4-bit chunks → two hex digits
        const s = hex.vecToString(vec(8n)(0xa5n))
        if (s !== 'a5') { throw [s] }
    },
    encodeUnaligned: () => {
        // 6 bits → first 4-bit chunk + a 2-bit tail that popFront pads with
        // trailing zeros (the standard `popFront` behaviour the codec inherits).
        const s = hex.vecToString(vec(6n)(0b101001n))
        if (s !== 'a4') { throw [s] }
    },
    decodeEmpty: () => {
        const v = hex.stringToVec('')
        if (v !== empty) { throw [v] }
    },
    decodeRoundTrip: () => {
        const v = hex.stringToVec('ab')
        if (v !== vec(8n)(0xabn)) { throw [v] }
    },
    decodeInvalid: () => {
        if (hex.stringToVec('z') !== null) { throw 'invalid char should return null' }
        if (hex.stringToVec('aZ') !== null) { throw 'mixed invalid char should return null' }
    },
    normalizeHit: () => {
        // 'A' lowercases to 'a' — same vector as the lowercase input.
        const a = cb32.stringToVec('A')
        const b = cb32.stringToVec('a')
        if (a !== b) { throw [a, b] }
        // Crockford folds: i,l → 1 and o → 0.
        if (cb32.stringToVec('I') !== cb32.stringToVec('1')) { throw 'I→1' }
        if (cb32.stringToVec('l') !== cb32.stringToVec('1')) { throw 'l→1' }
        if (cb32.stringToVec('o') !== cb32.stringToVec('0')) { throw 'o→0' }
    },
    normalizeMiss: () => {
        if (cb32.stringToVec('u') !== null) { throw 'unknown char should return null' }
    },
    // Decodes a 1 Mibit hex string. With the O(n log n) `listToVec` builder this
    // runs in well under a second (was ~13 s node / ~43 s bun under the old
    // per-chunk `concat`).
    big: () => {
        const x = hex.stringToVec(bigSampleHex)
        assertEq(length(x!), maxLength)
    }
}
