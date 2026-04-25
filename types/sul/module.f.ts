/**
 * Synthetic Universal Language (SUL) — a universal encoding that bijectively maps any finite sequence of symbols to a single root symbol via a balanced tree,
 * from which the original sequence can be uniquely recovered.
 *
 * A *level* defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.
 * A *symbol* is an element of a level's alphabet `[0, n)`.
 * A *word* is a finite sequence of symbols that encodes into a single symbol of the next level.
 *
 * @module
 */

import { log2 } from '../bigint/module.f.ts'
import { equal } from '../list/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import type { StateScan } from '../function/operator/module.f.ts'

export const symbolToString = (s: bigint): string => s.toString(16)

export type Word = readonly bigint[]

export const wordToString = (word: Word): string =>
    word.map(symbolToString).join(',')

export const wordEqual = equal(strictEqual)

export type State = readonly[bigint|undefined, bigint]

export const emptyState: State = [undefined, 0n]

/**
 * A level of SUL with finite alphabet `[0, n)`.
 */
export type Level = {
    readonly sum: (i: bigint) => bigint
    /** Converts a valid word of symbols into a symbol of the next level. */
    readonly encode: (word: Word) => bigint
    /** Inverse of {@link encode}: restores the complete word from a symbol. */
    readonly decode: (i: bigint) => Word
    //
    readonly push: StateScan<bigint, State, bigint|undefined>
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
    const sum = (i: bigint) => (m2 << i) + i - k
    const encode = (word: Word) =>
        word.slice(0, -2).reduce((a, b) => a + sum(b - 1n), 0n)
        + sum(word.at(-2)!)
        + word.at(-1)!
        - n
    return {
        sum,
        encode,
        decode: i => {
            let result: Word = []
            while (true) {
                const r = log2((i + k) >> e1)
                const rSum = sum(r)
                const [s0, s0Sum, pSum] = rSum > i ? [r, rSum, undefined] : [r + 1n, sum(r + 1n), rSum]
                const s1 = i - s0Sum + n
                result = [...result, s0]
                if (s1 >= s0) { return [...result, s1] }
                i -= pSum ?? sum(s0 - 1n)
            }
        },
        push: ([last, state]) => i => {
            if (last === undefined) {
                return [undefined, [i, 0n]]
            }
            if (last > i) {
                return [undefined, [i, state + sum(last - 1n)]]
            }
            return [state + sum(last) + i - n, emptyState]
        }
    }
}
