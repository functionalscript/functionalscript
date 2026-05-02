import { assert, assertEq } from '../../../../dev/module.f.ts'
import { compress } from '../../hash/module.f.ts'
import { emptyEncodeState, encode, type EncodeState } from './module.f.ts'

type NodeList = readonly [bigint, bigint, bigint][]

const add = (l: bigint, r: bigint, m: bigint, s: NodeList): NodeList => [...s, [l, r, m]]
const enc = encode(add)
const initial: EncodeState<NodeList> = emptyEncodeState([])

// Run a complete valid word from a clean state; throws if no output is produced.
const runWord = (symbols: readonly bigint[]): readonly [bigint, NodeList] => {
    let state = initial
    for (const s of symbols) {
        const [out, newState] = enc(s, state)
        state = newState
        if (out !== undefined) { return [out, state[0]] }
    }
    throw symbols
}

// Every stored triple must satisfy m === compress(l, r).
const verifyStorage = (storage: NodeList) => {
    for (const [l, r, m] of storage) { assertEq(m, compress(l, r)) }
}

export default {
    // Minimum word [s0, t] with t == s0
    min_equal: () => {
        const [out, storage] = runWord([0n, 0n])
        assertEq(out, compress(0n, 0n))
        assertEq(storage.length, 1)
        verifyStorage(storage)
    },

    // Minimum word [s0, t] with t > s0
    min_greater: () => {
        const [out, storage] = runWord([0n, 1n])
        assertEq(out, compress(0n, 1n))
        assertEq(storage.length, 1)
        verifyStorage(storage)
    },

    // All symbols before the terminator return undefined
    intermediate_undefined: () => {
        const [r0, s0] = enc(1n, initial)
        assert(r0 === undefined)
        const [r1, s1] = enc(0n, s0)
        assert(r1 === undefined)
        const [r2] = enc(1n, s1)
        assert(r2 !== undefined)
    },

    // Three-symbol word [s0, s1, t]: end merges (s0,s1), then create merges (root, t)
    three_symbol: () => {
        const [out, storage] = runWord([1n, 0n, 0n])
        assertEq(out, compress(compress(1n, 0n), 0n))
        assertEq(storage.length, 2)
        verifyStorage(storage)
        // first add: merge of the two decreasing-prefix symbols during end
        assertEq(storage[0][0], 1n)
        assertEq(storage[0][1], 0n)
        // second add: merge of trie root with terminator
        assertEq(storage[1][0], compress(1n, 0n))
        assertEq(storage[1][1], 0n)
    },

    // Output equals the merged value in the last add call
    output_is_last_add: () => {
        const [out, storage] = runWord([1n, 0n, 1n])
        assertEq(out, storage.at(-1)![2])
    },

    // Stack is empty after flush; storage is preserved
    state_reset: () => {
        const s1 = enc(0n, initial)[1]
        const [, s2] = enc(0n, s1)
        assertEq(s2[1].length, 0)
        assertEq(s2[0].length, 1)
    },

    // Storage grows across consecutive words (not wiped on flush)
    storage_accumulates: () => {
        const s1 = enc(0n, initial)[1]
        const s2 = enc(1n, s1)[1]   // flush [0, 1]
        const s3 = enc(0n, s2)[1]
        const [, s4] = enc(0n, s3)  // flush [0, 0]
        assertEq(s4[0].length, 2)
        verifyStorage(s4[0])
    },

    // Two consecutive words encode independently and correctly
    two_words: () => {
        const s1 = enc(0n, initial)[1]
        const [r1, s2] = enc(1n, s1)
        assertEq(r1, compress(0n, 1n))
        const s3 = enc(0n, s2)[1]
        const [r2] = enc(0n, s3)
        assertEq(r2, compress(0n, 0n))
    },

    // Different words produce different hashes
    non_commutative: () => {
        const [out1] = runWord([0n, 1n])
        const [out2] = runWord([1n, 0n, 1n])
        assert(out1 !== out2)
    },
}
