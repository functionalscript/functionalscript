/**
 * Type-level API for the literal SUL level encoding.
 *
 * @module
 */

import type { Vec } from '../../../types/bit_vec/types.ts'
import type { Func } from '../../../types/function/types.ts'
import type { StateScan } from '../../../types/function/operator/types.ts'
import type { List } from '../../../types/list/types.ts'

export type Word = readonly bigint[]

/**
 * Streaming encoder state: `[last, part]`.
 * - `last` — the most recently consumed input symbol, or `undefined` before any symbol is seen.
 * - `part` — accumulated index offset from the decreasing prefix consumed so far.
 */
export type EncodeState = readonly [bigint | undefined, bigint]

/**
 * A literal SUL level with finite alphabet `[0, n)`.
 */
export type Level = {
    /** Number of valid words whose first symbol is ≤ `i`. */
    readonly sum: (i: bigint) => bigint
    /** Inverse of {@link Level.encode}: restores the complete word from a symbol. */
    readonly decode: (i: bigint) => List<bigint>
    /** Streaming encoder: processes one input symbol at a time, emitting an output symbol only
     *  when the terminating symbol `t >= last` arrives. */
    readonly encode: StateScan<bigint, EncodeState, bigint | undefined>
}

/** Combined encoder state for the three-level literal pipeline (L1 → L2 → L3). */
export type PipelineState = readonly [EncodeState, EncodeState, EncodeState]

export type LiteralToVec = Func<bigint, Vec>
