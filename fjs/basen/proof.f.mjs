import { assertEq, assertNotNullish } from '../asserts/module.f.mjs'
import { empty, maxLength, vec, length } from '../types/bit_vec/module.f.mjs'
import { baseN } from './module.f.mjs'

const hex = baseN(4n, '0123456789abcdef')

// A synthetic normalizer keeps this proof focused on `baseN`'s mechanism
// rather than duplicating the rules owned by a concrete codec.
const normalizedHex = baseN(4n, '0123456789abcdef', c =>
    c === 'x' ? 'a' : c.toLowerCase())

// Sample input for the `big` proof below: 262 144 `f` characters decode into a
// 1 Mibit (`maxLength`) vector.
const bigSampleHex = `f`.repeat(Number(maxLength >> 2n))

export const proof = {
    encodeEmpty: () => {
        const s = hex.vecToString(empty)
        assertEq(s, '', [s])
    },
    encodeAligned: () => {
        // Two 4-bit chunks → two hex digits
        const s = hex.vecToString(vec(8n)(0xa5n))
        assertEq(s, 'a5', [s])
    },
    encodeUnaligned: () => {
        // 6 bits → first 4-bit chunk + a 2-bit tail that popFront pads with
        // trailing zeros (the standard `popFront` behaviour the codec inherits).
        const s = hex.vecToString(vec(6n)(0b101001n))
        assertEq(s, 'a4', [s])
    },
    decodeEmpty: () => {
        const v = hex.stringToVec('')
        assertEq(v, empty, [v])
    },
    decodeRoundTrip: () => {
        const v = hex.stringToVec('ab')
        assertEq(v, vec(8n)(0xabn), [v])
    },
    decodeInvalid: () => {
        assertEq(hex.stringToVec('z'), null, 'invalid char should return null')
        assertEq(hex.stringToVec('aZ'), null, 'mixed invalid char should return null')
    },
    normalizeHit: () => {
        // 'A' lowercases to 'a' — same vector as the lowercase input.
        const a = normalizedHex.stringToVec('A')
        const b = normalizedHex.stringToVec('a')
        assertEq(a, b, [a, b])
        assertEq(normalizedHex.stringToVec('x'), a, 'x→a')
    },
    normalizeMiss: () => {
        assertEq(normalizedHex.stringToVec('z'), null, 'unknown char should return null')
    },
    // Decodes a 1 Mibit hex string. With the O(n log n) `listToVec` builder this
    // runs in well under a second (was ~13 s node / ~43 s bun under the old
    // per-chunk `concat`).
    big: () => {
        const x = hex.stringToVec(bigSampleHex)
        assertEq(length(assertNotNullish(x)), maxLength)
    }
}
