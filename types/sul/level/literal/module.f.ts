/**
 * Bijective encoding between words of level-k symbols and single symbols of level k+1,
 * for the first three literal SUL levels.
 *
 * @module
 */

import { log2 } from '../../../bigint/module.f.ts'
import { listToVec, msb, vec, type Vec } from '../../../bit_vec/module.f.ts'
import { strictEqual, type Equal, type StateScan } from '../../../function/operator/module.f.ts'
import { equal, map, type List } from '../../../list/module.f.ts'
import { join } from '../../../string/module.f.ts'

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
        encode: ([last, part]) => i => last === undefined ? [undefined, [i, 0n]] :
            last > i ? [undefined, [i, part + sum(last - 1n)]] :
            [part + sum(last) + i - n, emptyEncodeState]
    }
}

/** Level 1: binary alphabet `{0, 1}`, output alphabet size `5`. */
export const level1: Level = level(0n)

/** Level 2: 5-symbol input alphabet, output alphabet size `0x81`. */
export const level2: Level = level(2n)

/** Level 3: 129-symbol input alphabet, output alphabet size `2^136 + 1`. */
export const level3: Level = level(7n)

const { decode: decode1 } = level1

const { decode: decode2 } = level2

const { decode: decode3 } = level3

const concat = listToVec(msb)

const vec1 = vec(1n)

/** Decodes a level-1 symbol to its canonical MSB bit vector. */
export const literal1ToVec = (literal: bigint): Vec =>
    concat(map(vec1)(decode1(literal)))

/** Decodes a level-2 symbol to its canonical MSB bit vector (via level-1 decoding). */
export const literal2ToVec = (literal: bigint): Vec =>
    concat(map(literal1ToVec)(decode2(literal)))

/** Decodes a level-3 symbol to its canonical MSB bit vector (via level-2 and level-1 decoding). */
export const literal3ToVec = (literal: bigint): Vec =>
    concat(map(literal2ToVec)(decode3(literal)))
