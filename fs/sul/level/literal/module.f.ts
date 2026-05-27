/**
 * Bijective encoding between words of level-k symbols and single symbols of level k+1,
 * for the first three literal SUL levels.
 *
 * @module
 */

import { log2 } from '../../../types/bigint/module.f.ts'
import { msbConcat, vec, type Vec } from '../../../types/bit_vec/module.f.ts'
import type { Func } from '../../../types/function/module.f.ts'
import { strictEqual, type Equal, type StateScan } from '../../../types/function/operator/module.f.ts'
import { equal, map, type List } from '../../../types/list/module.f.ts'
import { join } from '../../../types/string/module.f.ts'

export const symbolToString = (s: bigint): string => s.toString(16)

export type Word = readonly bigint[]

export const wordToString = (word: List<bigint>): string =>
    join(',')(map(symbolToString)(word))

export const wordEqual: Equal<List<bigint>> = equal(strictEqual)

/**
 * Streaming encoder state: `[last, part]`.
 * - `last` — the most recently consumed input symbol, or `undefined` before any symbol is seen.
 * - `part` — accumulated index offset from the decreasing prefix consumed so far.
 */
export type EncodeState = readonly[bigint|undefined, bigint]

/** Initial encoder state: no symbols seen, zero offset. */
export const emptyEncodeState: EncodeState = [undefined, 0n]

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
    readonly encode: StateScan<bigint, EncodeState, bigint|undefined>
}

/**
 * Creates a {@link Level} for alphabet size `n = 2^e + 1`.
 *
 * The first three levels for a tree starting from a binary alphabet:
 *
 * | `e`  | `n`    |
 * |------|--------|
 * | `0`  | `2`    |
 * | `2`  | `5`    |
 * | `7`  | `0x81` |
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
    const sum = (i: bigint) => (m2 << i) + i - k
    const decode = (i: bigint): List<bigint> => () => {
        const r = log2((i + k) >> e1)
        const s0 = sum(r) > i ? r : r + 1n
        const s1 = i - sum(s0) + n
        return s1 >= s0 ? [s0, s1] : {
            first: s0,
            tail: decode(i - sum(s0 - 1n))
        }
    }
    return {
        sum,
        decode,
        encode: (i, [last, part]) => last === undefined ? [undefined, [i, 0n]] :
            last > i ? [undefined, [i, part + sum(last - 1n)]] :
            [part + sum(last) + i - n, emptyEncodeState]
    }
}

const l1 = level(0n)
const l2 = level(2n)
const l3 = level(7n)

/** Combined encoder state for the three-level literal pipeline (L1 → L2 → L3). */
export type PipelineState = readonly [EncodeState, EncodeState, EncodeState]

/** Initial state for the three-level literal pipeline. */
export const emptyPipelineState: PipelineState = [emptyEncodeState, emptyEncodeState, emptyEncodeState]

/**
 * Advances the three-level literal pipeline by one bit.
 * Returns a level-3 symbol whenever the pipeline emits, otherwise `undefined`.
 */
export const pipelineStep: StateScan<bigint, PipelineState, bigint | undefined> =
    (bit, [l1s, l2s, l3s]) => {
        const [l1Out, newL1s] = l1.encode(bit, l1s)
        if (l1Out === undefined) return [undefined, [newL1s, l2s, l3s]]
        const [l2Out, newL2s] = l2.encode(l1Out, l2s)
        if (l2Out === undefined) return [undefined, [newL1s, newL2s, l3s]]
        const [l3Out, newL3s] = l3.encode(l2Out, l3s)
        return [l3Out, [newL1s, newL2s, newL3s]]
    }

const vec1 = vec(1n)

export type LiteralToVec = Func<bigint, Vec>

const literalToVec = (prior: LiteralToVec, e: bigint): LiteralToVec => {
    const m = map(prior)
    const { decode } = level(e)
    return literal => msbConcat(m(decode(literal)))
}

/** Decodes a level-1 symbol to its canonical MSB bit vector. */
export const literal1ToVec: LiteralToVec = literalToVec(vec1, 0n)

/** Decodes a level-2 symbol to its canonical MSB bit vector (via level-1 decoding). */
export const literal2ToVec: LiteralToVec = literalToVec(literal1ToVec, 2n)

/** Decodes a level-3 symbol to its canonical MSB bit vector (via level-2 and level-1 decoding). */
export const literal3ToVec: LiteralToVec = literalToVec(literal2ToVec, 7n)
