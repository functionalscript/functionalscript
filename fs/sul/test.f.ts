import { assert, assertEq } from '../dev/module.f.ts'
import { compress, type Id } from './id/module.f.ts'
import { encode, emptyEncodeState } from './module.f.ts'
import type { Add } from './level/hash/module.f.ts'

type Merge = readonly [Id, Id, Id, boolean]

const run = (bits: readonly bigint[]): readonly [Id, readonly Merge[]] => {
    const log: Merge[] = []
    const add: Add<null> = (l, r, m, isSymbol) => { log.push([l, r, m, isSymbol] as const); return null }
    const enc = encode(add)
    let s = emptyEncodeState<null>(null)
    for (const b of bits) { s = enc.push(b, s) }
    return [enc.end(s), log]
}

const id = (bits: readonly bigint[]): Id => run(bits)[0]

const zeros = (n: number): readonly bigint[] => new Array(n).fill(0n)

export default {
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
