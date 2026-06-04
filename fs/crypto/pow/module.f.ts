/**
 * Bitcoin-style proof-of-work: compact **nBits** target decoding and
 * hash-vs-target verification using an injected SHA-2 hash.
 *
 * @module
 */
import { mask } from '../../types/bigint/module.f.ts'
import { type Vec, uint } from '../../types/bit_vec/module.f.ts'
import { computeSync, type Sha2 } from '../sha2/module.f.ts'

const nBitsMantissa = mask(24n)
const mantissaSign = 0x00800000n
const mantissaBody = 0x007fffffn
const exponentShift = 24n
const uint256Mask = mask(256n)

/** Genesis-block compact target (`0x1d00ffff`). */
export const genesisNBits = 0x1d00ffffn

/** Genesis-block uint256 target decoded from {@link genesisNBits}. */
export const genesisTarget =
    0x00000000ffff0000000000000000000000000000000000000000000000000000n

const decodeShift = (exponent: bigint): bigint => 8n * (exponent - 3n)

const compactTarget = (exponent: bigint) => (mantissa: bigint): bigint => {
    const shift = decodeShift(exponent)
    return shift >= 0n ? mantissa << shift : mantissa >> -shift
}

const negativeNBits = (mantissa: bigint): boolean =>
    mantissa !== 0n && (mantissa & mantissaSign) !== 0n

const overflowNBits = (exponent: bigint) => (mantissa: bigint) => (target: bigint): boolean =>
    target !== 0n &&
    (exponent > 34n || (mantissa !== 0n && (mantissa & mantissaBody) === 0n))

/**
 * Decodes compact **nBits** (32-bit block-header "bits") to a uint256 target:
 *
 * - `exponent = nBits >> 24`
 * - `mantissa = nBits & 0xffffff`
 * - `target = mantissa × 2^(8 × (exponent − 3))`
 *
 * Rejects malformed encodings per Bitcoin `SetCompact` rules (negative sign bit,
 * overflow, target wider than 256 bits).
 *
 * @param nBits - Compact target encoding.
 * @returns Decoded target as a big-endian unsigned integer.
 */
export const targetFromNBits = (nBits: bigint): bigint => {
    const exponent = nBits >> exponentShift
    const mantissa = nBits & nBitsMantissa
    if (negativeNBits(mantissa)) { throw 'negative nBits' }
    const target = compactTarget(exponent)(mantissa)
    if (overflowNBits(exponent)(mantissa)(target)) { throw 'overflow nBits' }
    if (target > uint256Mask) { throw 'target exceeds 256 bits' }
    return target
}

export type Pow = {
    /** Hash `data` with the configured `Sha2`; digest as big-endian uint256. */
    readonly hashInt: (data: Vec) => bigint
    /** Whether `hashInt(data) <= targetFromNBits(nBits)`. */
    readonly meets: (nBits: bigint) => (data: Vec) => boolean
}

/**
 * Builds PoW helpers for a hash function (typical consumer: {@link sha256}).
 *
 * @param hash - SHA-2 configuration whose digest is compared as uint256.
 */
export const pow = (hash: Sha2): Pow => {
    const c = computeSync(hash)
    const hashInt = (data: Vec): bigint => uint(c([data]))
    const meets = (nBits: bigint) => (data: Vec): boolean =>
        hashInt(data) <= targetFromNBits(nBits)
    return { hashInt, meets }
}
