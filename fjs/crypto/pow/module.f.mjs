/**
 * Bitcoin-style proof-of-work: compact **nBits** target decoding and
 * hash-vs-target verification using an injected SHA-2 hash.
 *
 * @module
 */

import { mask } from '../../types/bigint/module.f.mjs'
import { uint } from '../../types/bit_vec/module.f.mjs'
/** @import { Vec } from '../../types/bit_vec/types.ts' */
/** @import { Nullable } from '../../types/nullable/types.ts' */
import { computeSync, sha256 } from '../sha2/module.f.mjs'
/** @import { Sha2 } from '../sha2/types.ts' */
/** @import { Pow } from './types.ts' */

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

/** @type {(exponent: bigint) => bigint} */
const decodeShift = exponent => 8n * (exponent - 3n)

/** @type {(exponent: bigint) => (mantissa: bigint) => bigint} */
const compactTarget = exponent => mantissa => {
    const shift = decodeShift(exponent)
    return shift >= 0n ? mantissa << shift : mantissa >> -shift
}

/** @type {(mantissa: bigint) => boolean} */
const negativeNBits = mantissa =>
    mantissa !== 0n && (mantissa & mantissaSign) !== 0n

/** @type {(exponent: bigint) => (mantissa: bigint) => (target: bigint) => boolean} */
const overflowNBits = exponent => mantissa => target =>
    target !== 0n &&
    (exponent > 34n || (mantissa !== 0n && (mantissa & mantissaBody) === 0n))

/**
 * Decodes compact **nBits** (32-bit block-header "bits") to a uint256 target:
 *
 * - `exponent = nBits >> 24`
 * - `mantissa = nBits & 0xffffff`
 * - `target = mantissa × 2^(8 × (exponent − 3))`
 *
 * Returns `null` for malformed encodings per Bitcoin `SetCompact` rules (negative
 * sign bit, overflow, target wider than 256 bits).
 *
 * @param {bigint} nBits Compact target encoding.
 * @returns {Nullable<bigint>} Decoded target, or `null` when **nBits** is invalid.
 */
export const targetFromNBits = nBits => {
    const exponent = nBits >> exponentShift
    const mantissa = nBits & nBitsMantissa
    if (negativeNBits(mantissa)) { return null }
    const target = compactTarget(exponent)(mantissa)
    if (overflowNBits(exponent)(mantissa)(target)) { return null }
    if (target > uint256Mask) { return null }
    return target
}

/**
 * Builds PoW helpers for a hash function (typical consumer: {@link sha256}).
 *
 * @param {Sha2} hash SHA-2 configuration whose digest is compared as uint256.
 * @returns {Pow}
 */
export const pow = hash => {
    const c = computeSync(hash)
    /** @type {(data: Vec) => bigint} */
    const hashInt = data => uint(c([data]))
    /** @type {(nBits: bigint) => (data: Vec) => boolean} */
    const meets = nBits => data => {
        const target = targetFromNBits(nBits)
        return target !== null && hashInt(data) <= target
    }
    return { hashInt, meets }
}

/** SHA-256 proof-of-work (`pow(sha256)`). */
export const sha256Pow = pow(sha256)

/** Bitcoin block-header PoW; same as {@link sha256Pow}. */
export const bitcoinPow = sha256Pow
