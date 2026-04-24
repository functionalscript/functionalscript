/**
 * Synthetic Universal Language (SUL).
 * @module
 */

import { log2 } from "../bigint/module.f.ts"

/**
 * A level of SUL with finite alphabet `[0, n)`.
 */
export type Level = {
    readonly count: (i: bigint) => bigint
    readonly sum: (i: bigint) => bigint
    /** Converts a valid sequence of symbols into a symbol of the next level. */
    readonly encode: (sequence: readonly bigint[]) => bigint
    readonly decode1: (i: bigint) => bigint
}

/**
 * Creates a {@link Level} for a specific alphabet size `n`, where `n = 2^e + 1`.
 *
 * Usual first three levels for a tree that starts with a binary (two-symbol) alphabet:
 *
 * - `level(0n)`: `n = 2`
 * - `level(2n)`: `n = 5`
 * - `level(7n)`: `n = 0x81`
 *
 * @param e `log2(n - 1)`
 */
export const level = (e: bigint): Level => {
    // m = n - 1
    const m = 1n << e
    const n = m + 1n
    // k = n - 2
    const k = m - 1n
    // m2 = 2 * m
    const m2 = m << 1n
    const e1 = e + 1n
    const count = (i: bigint) => i < 0n ? 0n : (m << i) + 1n
    const sum = (i: bigint) => (m2 << i) - k + i
    const decode1 = (i: bigint) => {
        const j = i + k
        const result = log2(j >> e1)
        const offset = (1n << (e1 + result)) + result
        return offset > j ? result : result + 1n
    }
    return {
        count,
        sum,
        encode: sequence =>
            sequence.slice(0, -2).reduce((a, b) => a + sum(b - 1n), 0n)
            + sum(sequence.at(-2)!)
            + sequence.at(-1)!
            - n,
        decode1
    }
}
