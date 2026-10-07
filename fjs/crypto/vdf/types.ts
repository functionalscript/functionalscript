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
 * State of the interactive VDF demo. `y` is the editable hex output; editing
 * the text or steps clears both it and the run.
 */
export type DemoState = {
    readonly text: string
    readonly steps: string
    readonly y: string
    readonly run: DemoRun | null
}
