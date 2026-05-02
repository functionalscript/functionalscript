import { assert, assertEq } from '../../../../dev/module.f.ts'
import { compress, level3Id, type Id } from '../../id/module.f.ts'
import { emptyEncodeState, encode, type EncodeState } from './module.f.ts'

type NodeList = readonly [Id, Id, Id][]

const add = (l: Id, r: Id, m: Id, s: NodeList): NodeList => [...s, [l, r, m]]
const enc = encode(add)
const initial: EncodeState<NodeList> = emptyEncodeState([])

// Run a complete valid word from a clean state; throws if no output is produced.
const runWord = (symbols: readonly Id[]): readonly [Id, NodeList] => {
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

const s0 = level3Id(0n)
const s1 = level3Id(1n)

export default {
    // Minimum word [s0, t] with t == s0
    min_equal: () => {
        const [out, storage] = runWord([s0, s0])
        assertEq(out, compress(s0, s0))
        assertEq(storage.length, 1)
        verifyStorage(storage)
    },

    // Minimum word [s0, t] with t > s0
    min_greater: () => {
        const [out, storage] = runWord([s0, s1])
        assertEq(out, compress(s0, s1))
        assertEq(storage.length, 1)
        verifyStorage(storage)
    },

    // All symbols before the terminator return undefined
    intermediate_undefined: () => {
        const [r0, st0] = enc(s1, initial)
        assert(r0 === undefined)
        const [r1, st1] = enc(s0, st0)
        assert(r1 === undefined)
        const [r2] = enc(s1, st1)
        assert(r2 !== undefined)
    },

    // Three-symbol word [s0, s1, t]: end merges (s0,s1), then create merges (root, t)
    three_symbol: () => {
        const [out, storage] = runWord([s1, s0, s0])
        assertEq(out, compress(compress(s1, s0), s0))
        assertEq(storage.length, 2)
        verifyStorage(storage)
        // first add: merge of the two decreasing-prefix symbols during end
        assertEq(storage[0][0], s1)
        assertEq(storage[0][1], s0)
        // second add: merge of trie root with terminator
        assertEq(storage[1][0], compress(s1, s0))
        assertEq(storage[1][1], s0)
    },

    // Output equals the merged value in the last add call
    output_is_last_add: () => {
        const [out, storage] = runWord([s1, s0, s1])
        assertEq(out, storage.at(-1)![2])
    },

    // Stack is empty after flush; storage is preserved
    state_reset: () => {
        const st1 = enc(s0, initial)[1]
        const [, st2] = enc(s0, st1)
        assertEq(st2[1].length, 0)
        assertEq(st2[0].length, 1)
    },

    // Storage grows across consecutive words (not wiped on flush)
    storage_accumulates: () => {
        const st1 = enc(s0, initial)[1]
        const st2 = enc(s1, st1)[1]   // flush [s0, s1]
        const st3 = enc(s0, st2)[1]
        const [, st4] = enc(s0, st3)  // flush [s0, s0]
        assertEq(st4[0].length, 2)
        verifyStorage(st4[0])
    },

    // Two consecutive words encode independently and correctly
    two_words: () => {
        const st1 = enc(s0, initial)[1]
        const [r1, st2] = enc(s1, st1)
        assertEq(r1, compress(s0, s1))
        const st3 = enc(s0, st2)[1]
        const [r2] = enc(s0, st3)
        assertEq(r2, compress(s0, s0))
    },

    // Different words produce different hashes
    non_commutative: () => {
        const [out1] = runWord([s0, s1])
        const [out2] = runWord([s1, s0, s1])
        assert(out1 !== out2)
    },
}
