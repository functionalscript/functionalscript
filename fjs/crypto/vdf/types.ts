/**
 * Types for the Sloth verifiable delay function.
 *
 * @module
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

/**
 * An evaluation of `steps` Sloth steps: `value` is the result after `done`
 * steps, and `running` is whether the demo schedules the next batch.
 */
export type DemoRun = {
    readonly steps: bigint
    readonly done: bigint
    readonly value: bigint
    readonly running: boolean
}

/**
 * What pressing Verify found for the claimed `y`: it verifies, it does not,
 * it is not hexadecimal, or it is not below `p`.
 */
export type DemoVerdict = 'verified' | 'rejected' | 'notHex' | 'notBelowP'

/**
 * State of the interactive VDF demo. `run` holds the prover's evaluation and
 * `claimed` the verifier's hex input; `verdict` is what Verify found for them.
 * Editing the text or steps clears the run and the verdict, and editing the
 * claimed `y` clears the verdict, so no verdict outlives its inputs.
 */
export type DemoState = {
    readonly text: string
    readonly steps: string
    readonly claimed: string
    readonly run: DemoRun | null
    readonly verdict: DemoVerdict | null
}
