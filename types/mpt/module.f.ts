import type { StateScan } from '../function/operator/module.f.ts'

/**
 * [left, right, hash]
 */
export type Node = readonly[bigint, bigint, bigint]

export type Compress = (a: bigint, b: bigint) => bigint

export type Candidate = readonly[bigint, bigint]

export type State = readonly Candidate[]

/**
 * Builds a Merkle Patricia Trie from a lexicographically sorted (ascending or
 * descending) stream of leaves.
 *
 * Each call processes one leaf `u` and returns the {@link Node}s that become
 * complete on that step, plus the updated right-spine {@link State}.
 *
 * Merge rule: pop and compress the two rightmost candidates whenever their
 * mutual XOR is smaller than the XOR of the top candidate with the new leaf
 * (i.e. the two are more tightly coupled with each other than with `u`).
 */
export const mpt = (compress: Compress): StateScan<bigint, State, readonly Node[]> =>
    state => u => {
        let nodes: readonly Node[] = []
        let stack: readonly Candidate[] = state
        while (stack.length >= 2) {
            const [rLeaf, rHash] = stack[stack.length - 1]
            const [lLeaf, lHash] = stack[stack.length - 2]
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const h = compress(lHash, rHash)
            nodes = [...nodes, [lHash, rHash, h]]
            stack = [...stack.slice(0, -2), [rLeaf, h]]
        }
        return [nodes, [...stack, [u, u]]]
    }
