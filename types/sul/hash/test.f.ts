import { assertEq } from '../../../dev/module.f.ts'
import { compress } from './module.f.ts'

// rawPrefix = 1n << 254n — bit 254 set, bit 255 not set
const rawPrefix = 0x4000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

// hashPrefix = 1n << 255n — bit 255 set
const hashPrefix = 0x8000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n

// rawId(concat(vec(8n)(a_bits), vec(8n)(b_bits)))
// = rawPrefix | (a_bits << 8n) | b_bits | (1n << 16n)
//
// literal3ToVec bit patterns for symbols used below:
//   0  → vec(8n)(0n)     4  → vec(8n)(3n)
//   1  → vec(8n)(1n)     10 → vec(8n)(5n)
//                        128 → vec(8n)(15n)

export default {
    // Two level-3 literals whose combined bit vectors fit inline (≤ 253 bits)
    inline_0_0:   () => assertEq(compress(0n, 0n),   rawPrefix | 0x1_0000n),
    inline_0_1:   () => assertEq(compress(0n, 1n),   rawPrefix | 0x1_0001n),
    inline_1_0:   () => assertEq(compress(1n, 0n),   rawPrefix | 0x1_0100n),
    inline_1_1:   () => assertEq(compress(1n, 1n),   rawPrefix | 0x1_0101n),
    inline_0_4:   () => assertEq(compress(0n, 4n),   rawPrefix | 0x1_0003n),
    inline_4_0:   () => assertEq(compress(4n, 0n),   rawPrefix | 0x1_0300n),
    inline_10_128: () => assertEq(compress(10n, 128n), rawPrefix | 0x1_050Fn),

    // Non-commutativity: argument order is preserved in concatenation
    non_commutative: () => {
        if (compress(0n, 1n) === compress(1n, 0n)) { throw compress(0n, 1n) }
    },

    // Hash input: bit 255 set in either argument always triggers SHA2-based merge
    hash_left:  () => assertEq(
        compress(hashPrefix, 0n),
        0x751bede8136e841b8e222337696ec78a8bab8f68225eac33aa7c2a90f24199cfn,
    ),
    hash_right: () => assertEq(
        compress(0n, hashPrefix),
        0xf0bc43bb4e614515a6eed77c071363504473d08d950199c75b8b18e6bde64b32n,
    ),
    hash_non_commutative: () => {
        if (compress(hashPrefix, 0n) === compress(0n, hashPrefix)) {
            throw compress(hashPrefix, 0n)
        }
    },

    // Overflow: two 127-bit raw payloads sum to 254 bits, exceeding the 253-bit inline limit
    overflow: () => assertEq(
        compress(rawPrefix | ((1n << 128n) - 1n), rawPrefix | ((1n << 128n) - 1n)),
        0xc0caa9d6cf74446133e0d3c5d891a40103045a3df74963c8ecf796f96dbf9017n,
    ),
}
