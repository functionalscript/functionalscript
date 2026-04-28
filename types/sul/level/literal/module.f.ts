import { log2 } from '../../../bigint/module.f.ts'
import { listToVec, msb, vec, type Vec } from '../../../bit_vec/module.f.ts'
import { strictEqual, type StateScan } from '../../../function/operator/module.f.ts'
import { equal, map, type List } from '../../../list/module.f.ts'
import { join } from '../../../string/module.f.ts'

export const symbolToString = (s: bigint): string => s.toString(16)

export type Word = readonly bigint[]

export const wordToString = (word: List<bigint>): string =>
    join(',')(map(symbolToString)(word))

export const wordEqual = equal(strictEqual)

export type State = readonly[bigint|undefined, bigint]

export const emptyState: State = [undefined, 0n]

/**
 * A level of SUL with finite alphabet `[0, n)`.
 */
export type Level = {
    readonly sum: (i: bigint) => bigint
    /** Inverse of {@link encode}: restores the complete word from a symbol. */
    readonly decode: (i: bigint) => List<bigint>
    /** Encoding input symbols into output symbols. */
    readonly encode: StateScan<bigint, State, bigint|undefined>
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
            [part + sum(last) + i - n, emptyState]
    }
}

export const level1 = level(0n)

export const level2 = level(2n)

export const level3 = level(7n)

const { decode: decode1 } = level1

const { decode: decode2 } = level2

const { decode: decode3 } = level3

const concat = listToVec(msb)

const vec1 = vec(1n)

export const literal1ToVec = (literal: bigint): Vec =>
    concat(map(vec1)(decode1(literal)))

export const literal2ToVec = (literal: bigint): Vec =>
    concat(map(literal1ToVec)(decode2(literal)))

export const literal3ToVec = (literal: bigint): Vec =>
    concat(map(literal2ToVec)(decode3(literal)))