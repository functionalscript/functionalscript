/**
 * Bijective encoding between words of level-k symbols and single symbols of level k+1,
 * for the first three literal SUL levels. See `./types.ts` for the
 * `Word`/`EncodeState`/`Level`/`PipelineState`/`LiteralToVec` type-level API.
 *
 * @module
 *
 * @import { Equal, StateScan } from '../../../types/function/operator/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { EncodeState, Level, LiteralToVec, PipelineState } from './types.ts'
 */

import { log2 } from '../../../types/bigint/module.f.mjs'
import { msb, vec } from '../../../types/bit_vec/module.f.mjs'
import { strictEqual } from '../../../types/function/operator/module.f.mjs'
import { equal, map } from '../../../types/list/module.f.mjs'
import { join } from '../../../types/string/module.f.mjs'

/** @type {(s: bigint) => string} */
export const symbolToString = s => s.toString(16)

/** @type {(word: List<bigint>) => string} */
export const wordToString = word =>
    join(',')(map(symbolToString)(word))

/** @type {Equal<List<bigint>>} */
export const wordEqual = equal(strictEqual)

/** Initial encoder state: no symbols seen, zero offset. */
/** @type {EncodeState} */
export const emptyEncodeState = [undefined, 0n]

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
 * @param {bigint} e `log2(n - 1)`
 * @returns {Level}
 */
export const level = e => {
    // m = n - 1
    const m = 1n << e
    const n = m + 1n
    // k = n - 2
    const k = m - 1n
    // m2 = 2 * m
    const m2 = m << 1n
    const e1 = e + 1n
    const sum = (/** @type {bigint} */ i) => (m2 << i) + i - k
    /** @type {(i: bigint) => List<bigint>} */
    const decode = i => () => {
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

/** Initial state for the three-level literal pipeline. */
/** @type {PipelineState} */
export const emptyPipelineState = [emptyEncodeState, emptyEncodeState, emptyEncodeState]

/**
 * Advances the three-level literal pipeline by one bit.
 * Returns a level-3 symbol whenever the pipeline emits, otherwise `undefined`.
 *
 * @type {StateScan<bigint, PipelineState, bigint | undefined>}
 */
export const pipelineStep =
    (bit, [l1s, l2s, l3s]) => {
        const [l1Out, newL1s] = l1.encode(bit, l1s)
        if (l1Out === undefined) return [undefined, [newL1s, l2s, l3s]]
        const [l2Out, newL2s] = l2.encode(l1Out, l2s)
        if (l2Out === undefined) return [undefined, [newL1s, newL2s, l3s]]
        const [l3Out, newL3s] = l3.encode(l2Out, l3s)
        return [l3Out, [newL1s, newL2s, newL3s]]
    }

const vec1 = vec(1n)

const { listToVec } = msb

/** @type {(prior: LiteralToVec, e: bigint) => LiteralToVec} */
const literalToVec = (prior, e) => {
    const m = map(prior)
    const { decode } = level(e)
    return literal => listToVec(m(decode(literal)))
}

/** Decodes a level-1 symbol to its canonical MSB bit vector. */
/** @type {LiteralToVec} */
export const literal1ToVec = literalToVec(vec1, 0n)

/** Decodes a level-2 symbol to its canonical MSB bit vector (via level-1 decoding). */
/** @type {LiteralToVec} */
export const literal2ToVec = literalToVec(literal1ToVec, 2n)

/** Decodes a level-3 symbol to its canonical MSB bit vector (via level-2 and level-1 decoding). */
/** @type {LiteralToVec} */
export const literal3ToVec = literalToVec(literal2ToVec, 7n)
