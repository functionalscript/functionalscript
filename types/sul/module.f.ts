/**
 * Synthetic Universal Language (SUL) — a universal encoding that bijectively maps any finite sequence of symbols to
 * a single root symbol via a balanced tree, from which the original sequence can be uniquely recovered.
 *
 * A *level* defines a finite alphabet `[0, n)` and the bijection between words over that alphabet and symbols of the next level.
 * A *symbol* is an element of a level's alphabet `[0, n)`.
 * A *word* is a finite sequence of symbols that encodes into a single symbol of the next level.
 *
 * @module
 */

import { log2, mask } from '../bigint/module.f.ts'
import { equal, map, toArray, type List } from '../list/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import type { StateScan } from '../function/operator/module.f.ts'
import { join } from '../string/module.f.ts'
import { msb, uint, uintChunkList, unpack, vec, type Vec } from '../bit_vec/module.f.ts'
import type { Effect, Operation } from '../effects/module.f.ts'
import { assert, todo } from '../../dev/module.f.ts'
import { utf8 } from '../../text/module.f.ts'
import { secp256r1, type Point2D } from '../../crypto/secp/module.f.ts'
import { base32, type V8 } from '../../crypto/sha2/module.f.ts'

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

export type HashState = List<Vec>

export type HashLevel<T extends Operation> = {
    /**
     * Note: Currently we return an effect of a list of bit vectors.
     *       This way, we have to read the complete list into memory.
     *
     * TODO: Return an asynchronous (effect) list.
     *
     * @param v a symbol from the next level.
     * @returns
     */
    readonly decode: (v: Vec) => Effect<T, List<Vec>>
    readonly encode: StateScan<Vec, HashState, Vec|undefined>
}

// 32 bytes = 256 bits.
//
//              0               1
//              0123456789ABCDEF0123456789ABCDEF
const ivSeed = "Synthetic Universal Language 001"

const utf8IvSeed = utf8(ivSeed)

const c = secp256r1


// 0x325d5666573eb118f32191de20d17f6433392ba3291ae46c1474a5eda5383f25
const ivUint: bigint = (c.mul(uint(utf8IvSeed))(c.g) as Point2D)[0]

// 64 hex = 256 bits = 32 bytes:
//                  0               1               2               3
//                  0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF
assert(ivUint === 0x325d5666573eb118f32191de20d17f6433392ba3291ae46c1474a5eda5383f25n)

const iv = toArray(uintChunkList(msb)(32n)({ length: 256n, uint: ivUint })) as V8

const hash = base32.compress(iv)

const vecX100 = vec(0x100n)

const level3Id = vecX100

const rawPrefix = 1n << 254n

assert(rawPrefix ===
    0x4000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)

/**
 * Note: length(symbol) <= 253n
 *
 * @param symbol
 * @returns
 */
const rawId = (symbol: Vec): Vec => {
    const { length, uint } = unpack(symbol)
    return vecX100(rawPrefix | uint | (1n << length))
}

const hashPrefix = 1n << 255n

assert(hashPrefix ===
    0x8000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)

const hashId = (symbol: Vec): Vec => {
    const { uint } = unpack(symbol)
    return vecX100(hashPrefix | uint)
}

export const hashLevel = <T extends Operation>(get: (hash: Vec) => Effect<T, Vec>): HashLevel<T> =>
    todo()
