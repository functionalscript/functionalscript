import { assert, assertEq } from '../../../dev/module.f.ts'
import { mask } from '../../bigint/module.f.ts'
import { vec } from '../../bit_vec/module.f.ts'
import { compress, hashId, isHash, isRaw, level3Id, rawId } from './module.f.ts'
import { asBase } from '../../nominal/module.f.ts'

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

export default {
    // Two level-3 literals whose combined bit vectors fit inline (≤ 253 bits)
    inline_00_00: () => assertEq(compress(level3Id(0x00n), level3Id(0x00n)), rawId(vec(16n)(0x0000n))),
    inline_00_01: () => assertEq(compress(level3Id(0x00n), level3Id(0x01n)), rawId(vec(16n)(0x0001n))),
    inline_01_00: () => assertEq(compress(level3Id(0x01n), level3Id(0x00n)), rawId(vec(16n)(0x0100n))),
    inline_01_01: () => assertEq(compress(level3Id(0x01n), level3Id(0x01n)), rawId(vec(16n)(0x0101n))),
    inline_00_04: () => assertEq(compress(level3Id(0x00n), level3Id(0x04n)), rawId(vec(16n)(0x0003n))),
    inline_04_00: () => assertEq(compress(level3Id(0x04n), level3Id(0x00n)), rawId(vec(16n)(0x0300n))),
    inline_0A_80: () => assertEq(compress(level3Id(0x0An), level3Id(0x80n)), rawId(vec(16n)(0x050Fn))),

    // Inline outputs are raw-encoded (bit 254 set, bit 255 not set)
    inline_is_raw: () => assert(isRaw(compress(level3Id(0x00n), level3Id(0x00n)))),

    // Non-commutativity: argument order is preserved in concatenation
    non_commutative: () => {
        if (compress(level3Id(0n), level3Id(1n)) === compress(level3Id(1n), level3Id(0n))) {
            throw compress(level3Id(0n), level3Id(1n))
        }
    },

    // Overflow: two 127-bit raw payloads sum to 254 bits, exceeding the 253-bit inline limit
    overflow_is_hash: () => assert(isHash(overflowHash)),

    // Hash input: either argument being a hash always triggers SHA2-based merge
    hash_left_is_hash:  () => assert(isHash(compress(overflowHash, level3Id(0n)))),
    hash_right_is_hash: () => assert(isHash(compress(level3Id(0n), overflowHash))),
    hash_non_commutative: () => {
        if (compress(overflowHash, level3Id(0n)) === compress(level3Id(0n), overflowHash)) {
            throw compress(overflowHash, level3Id(0n))
        }
    },

    // High-bit sensitivity: prefix bit of `a` is included in the SHA2 upper half
    hash_merge_a_high_bits: () => {
        if (compress(hashId(0n), hashId(0n)) === compress(level3Id(0n), hashId(0n))) {
            throw compress(hashId(0n), hashId(0n))
        }
    },
    // High-bit sensitivity: prefix bit of `b` is included in the SHA2 lower half
    hash_merge_b_high_bits: () => {
        if (compress(hashId(0n), hashId(0n)) === compress(hashId(0n), level3Id(0n))) {
            throw compress(hashId(0n), hashId(0n))
        }
    },

    // Shift correctness: changing a bit in `a` (upper 256 bits of SHA2 input) changes result
    hash_merge_a_sensitivity: () => {
        if (compress(hFF, hFF) === compress(hFE, hFF)) { throw compress(hFF, hFF) }
    },
    // Shift correctness: changing a bit in `b` (lower 256 bits of SHA2 input) changes result
    hash_merge_b_sensitivity: () => {
        if (compress(hFF, hFF) === compress(hFF, hFE)) { throw compress(hFF, hFF) }
    },
    // Shift correctness: same bit-flip in `a` vs `b` lands at different SHA2 input positions
    hash_merge_shift: () => {
        if (compress(hFE, hFF) === compress(hFF, hFE)) { throw compress(hFE, hFF) }
    },
}
