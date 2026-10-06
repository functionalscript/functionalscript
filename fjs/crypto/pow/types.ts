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

/** A search over a validated nonce and target, retaining its last hash. */
export type DemoSearch = {
    readonly nonce: bigint
    readonly target: bigint
    readonly hash: bigint
    readonly start: bigint
    readonly attempts: bigint
    readonly running: boolean
}

/** State of the interactive proof-of-work demo. Editing a field clears the search. */
export type DemoState = {
    readonly text: string
    readonly nonce: string
    readonly nBits: string
    readonly search: DemoSearch | null
}
