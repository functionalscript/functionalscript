/**
 * Types for Bitcoin-style proof-of-work verification.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'

/**
 * @property hashInt
 *
 * Hash `data` with the configured `Sha2`; digest as big-endian uint256.
 *
 * @property meets
 *
 * Whether `hashInt(data) <= targetFromNBits(nBits)`; `false` when **nBits** is invalid.
 */
export type Pow = {
    readonly hashInt: (data: Vec) => bigint
    readonly meets: (nBits: bigint) => (data: Vec) => boolean
}
