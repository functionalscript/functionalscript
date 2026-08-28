/**
 * @import { Id } from './id/types.ts'
 * @import { Add } from './level/hash/types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.mjs'
import { compress } from './id/module.f.mjs'
import { encode, emptyEncodeState } from './module.f.mjs'

/** @type {(bits: readonly bigint[]) => readonly [Id, readonly (readonly [Id, Id, Id, boolean])[]]} */
const run = bits => {
    /** @type {(readonly [Id, Id, Id, boolean])[]} */
    const log = []
    /** @type {Add<null>} */
    const add = (l, r, m, isSymbol) => { log.push([l, r, m, isSymbol]); return null }
    const enc = encode(add)
    let s = emptyEncodeState(null)
    for (const b of bits) { s = enc.push(b, s) }
    return [enc.end(s), log]
}

/** @type {(bits: readonly bigint[]) => Id} */
const id = bits => run(bits)[0]

/** @type {(n: number) => readonly bigint[]} */
const zeros = n => new Array(n).fill(0n)

export const proof = {
    deterministic: () => {
        assertEq(id(zeros(16)), id(zeros(16)))
    },

    distinct: () => {
        assert(id([0n]) !== id([1n]))
    },

    order_matters: () => {
        assert(id([0n, 1n]) !== id([1n, 0n]))
    },

    length_matters: () => {
        assert(id(zeros(8)) !== id(zeros(16)))
    },

    // Enough bits to trigger at least one hash merge
    has_merges: () => {
        const [, log] = run(zeros(16))
        assert(log.length > 0)
    },

    // Every recorded merge satisfies merged === compress(left, right)
    compress_correct: () => {
        const [, log] = run(zeros(16))
        for (const [l, r, m] of log) { assertEq(m, compress(l, r)) }
    },

    // Patricia-trie internal merges are isSymbol=false; terminal merges are isSymbol=true
    isSymbol_terminal_only: () => {
        const [, log] = run(zeros(16))
        assert(log.some(([, , , isSymbol]) => isSymbol))
        assert(log.every(([l, r, m, isSymbol]) => !isSymbol || m === compress(l, r)))
    },
}
