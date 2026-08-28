/**
 * Types for the Sloth verifiable delay function.
 */

import type { Nullable } from '../../types/nullable/types.ts'

/**
 * Sloth VDF over prime `modulus` (`p ≡ 3 (mod 4)`).
 */
export type Sloth = {
    readonly p: bigint
    readonly quadRes: (x: bigint) => boolean
    readonly modSqrt: (x: bigint) => bigint
    /** Sequential Sloth permutation; `null` when `steps < 0`. */
    readonly eval: (steps: bigint) => (x: bigint) => Nullable<bigint>
    /** Fast verification of {@link Sloth.eval}; `false` when `steps < 0`. */
    readonly verify: (steps: bigint) => (x: bigint) => (y: bigint) => boolean
}
