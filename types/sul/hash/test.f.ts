import { assertEq } from '../../../dev/module.f.ts'
import { vec } from '../../bit_vec/module.f.ts'
import { compress, hashPrefix, rawId } from './module.f.ts'

// literal3ToVec bit patterns for symbols used below:
//   0  → vec(8n)(0n)     4  → vec(8n)(3n)
//   1  → vec(8n)(1n)     10 → vec(8n)(5n)
//                        128 → vec(8n)(15n)

export default {
    // Two level-3 literals whose combined bit vectors fit inline (≤ 253 bits)
    inline_00_00: () => assertEq(compress(0x00n, 0x00n), rawId(vec(16n)(0x0000n))),
    inline_00_01: () => assertEq(compress(0x00n, 0x01n), rawId(vec(16n)(0x0001n))),
    inline_01_00: () => assertEq(compress(0x01n, 0x00n), rawId(vec(16n)(0x0100n))),
    inline_01_01: () => assertEq(compress(0x01n, 0x01n), rawId(vec(16n)(0x0101n))),
    inline_00_04: () => assertEq(compress(0x00n, 0x04n), rawId(vec(16n)(0x0003n))),
    inline_04_00: () => assertEq(compress(0x04n, 0x00n), rawId(vec(16n)(0x0300n))),
    inline_0A_80: () => assertEq(compress(0x0An, 0x80n), rawId(vec(16n)(0x050Fn))),

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
        compress(
            rawId(vec(0x7Fn)((1n << 0x7Fn) - 1n)),
            rawId(vec(0x7Fn)((1n << 0x7Fn) - 1n))
        ),
        0xc0caa9d6cf74446133e0d3c5d891a40103045a3df74963c8ecf796f96dbf9017n,
    ),
}
