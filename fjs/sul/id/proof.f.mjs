import { assert, assertEq } from '../../asserts/module.f.mjs'
import { mask } from '../../types/bigint/module.f.mjs'
import { vec } from '../../types/bit_vec/module.f.mjs'
import { compress, hashId, isHash, isRaw, level3Id, rawId } from './module.f.mjs'
import { asBase } from '../../types/nominal/module.f.mjs'

// literal3ToVec bit patterns for symbols used below:
//   0  → vec(8n)(0n)     4  → vec(8n)(3n)
//   1  → vec(8n)(1n)     10 → vec(8n)(5n)
//                        128 → vec(8n)(15n)

// Two 127-bit raw payloads overflow the 253-bit inline limit, producing a hash value.
const rawX7F = rawId(vec(0x7Fn)(mask(0x7Fn)))
const overflowHash = compress(rawX7F, rawX7F)

const hFF = hashId(mask(0xFFn))
const hFE = hashId(mask(0xFFn) - 1n)

assertEq(asBase(level3Id(0n)), 0n)
assertEq(asBase(hashId(0n)), 1n << 0xFFn)
assertEq(asBase(hFF), mask(0x100n))

export const proof = {
    // Two level-3 literals whose combined bit vectors fit inline (≤ 253 bits)
    inline0000: () => assertEq(compress(level3Id(0x00n), level3Id(0x00n)), rawId(vec(16n)(0x0000n))),
    inline0001: () => assertEq(compress(level3Id(0x00n), level3Id(0x01n)), rawId(vec(16n)(0x0001n))),
    inline0100: () => assertEq(compress(level3Id(0x01n), level3Id(0x00n)), rawId(vec(16n)(0x0100n))),
    inline0101: () => assertEq(compress(level3Id(0x01n), level3Id(0x01n)), rawId(vec(16n)(0x0101n))),
    inline0004: () => assertEq(compress(level3Id(0x00n), level3Id(0x04n)), rawId(vec(16n)(0x0003n))),
    inline0400: () => assertEq(compress(level3Id(0x04n), level3Id(0x00n)), rawId(vec(16n)(0x0300n))),
    inline0A80: () => assertEq(compress(level3Id(0x0An), level3Id(0x80n)), rawId(vec(16n)(0x050Fn))),

    // Inline outputs are raw-encoded (bit 254 set, bit 255 not set)
    inlineIsRaw: () => assert(isRaw(compress(level3Id(0x00n), level3Id(0x00n)))),

    // The tag is the *topmost* set bit: a hash id with bit 254 set is not raw,
    // and a raw id is not a hash
    hashIsNotRaw: () => assert(!isRaw(hFF)),
    rawIsNotHash: () => assert(!isHash(rawX7F)),

    // Non-commutativity: argument order is preserved in concatenation
    nonCommutative: () => {
        assert(compress(level3Id(0n), level3Id(1n)) !== compress(level3Id(1n), level3Id(0n)), compress(level3Id(0n), level3Id(1n)))
    },

    // Overflow: two 127-bit raw payloads sum to 254 bits, exceeding the 253-bit inline limit
    overflowIsHash: () => assert(isHash(overflowHash)),
    // The merged hash's eight SHA2 words are packed most significant first
    overflowHashValue: () => assertEq(
        asBase(overflowHash),
        0xc0caa9d6cf74446133e0d3c5d891a40103045a3df74963c8ecf796f96dbf9017n),

    // Hash input: either argument being a hash always triggers SHA2-based merge
    hashLeftIsHash: () => assert(isHash(compress(overflowHash, level3Id(0n)))),
    hashRightIsHash: () => assert(isHash(compress(level3Id(0n), overflowHash))),
    hashNonCommutative: () => {
        assert(compress(overflowHash, level3Id(0n)) !== compress(level3Id(0n), overflowHash), compress(overflowHash, level3Id(0n)))
    },

    // High-bit sensitivity: prefix bit of `a` is included in the SHA2 upper half
    hashMergeAHighBits: () => {
        assert(compress(hashId(0n), hashId(0n)) !== compress(level3Id(0n), hashId(0n)), compress(hashId(0n), hashId(0n)))
    },
    // High-bit sensitivity: prefix bit of `b` is included in the SHA2 lower half
    hashMergeBHighBits: () => {
        assert(compress(hashId(0n), hashId(0n)) !== compress(hashId(0n), level3Id(0n)), compress(hashId(0n), hashId(0n)))
    },

    // Shift correctness: changing a bit in `a` (upper 256 bits of SHA2 input) changes result
    hashMergeASensitivity: () => {
        assert(compress(hFF, hFF) !== compress(hFE, hFF), compress(hFF, hFF))
    },
    // Shift correctness: changing a bit in `b` (lower 256 bits of SHA2 input) changes result
    hashMergeBSensitivity: () => {
        assert(compress(hFF, hFF) !== compress(hFF, hFE), compress(hFF, hFF))
    },
    // Shift correctness: same bit-flip in `a` vs `b` lands at different SHA2 input positions
    hashMergeShift: () => {
        assert(compress(hFE, hFF) !== compress(hFF, hFE), compress(hFE, hFF))
    },
}
