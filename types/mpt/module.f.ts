import type { StateScan } from '../function/operator/module.f.ts'

/**
 * [left, right, hash]
 */
export type Node = readonly[bigint, bigint, bigint]

export type Compress = (a: bigint, b: bigint) => bigint

export type Candidate = readonly[bigint, bigint]

export type State = readonly Candidate[]

export type Mpt = {
    /**
     * Add one sorted leaf. Returns any {@link Node}s completed on this step
     * and the updated right-spine {@link State}.
     */
    readonly push: StateScan<bigint, State, readonly Node[]>
    /**
     * Flush the remaining candidates after all leaves have been pushed.
     * Returns the final {@link Node}s and the root hash, or `undefined` if
     * no leaves were ever added.
     */
    readonly end: (state: State) => readonly[readonly Node[], bigint|undefined]
}

/**
 * Builds a Merkle Patricia Trie from a lexicographically sorted (ascending or
 * descending) stream of leaves.
 *
 * Merge rule: pop and compress the two rightmost candidates whenever their
 * mutual XOR is smaller than the XOR of the top candidate with the new leaf
 * (i.e. the two are more tightly coupled with each other than with `u`).
 */
export const mpt = (compress: Compress): Mpt => {
    const push: StateScan<bigint, State, readonly Node[]> = state => u => {
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

    const end = (state: State): readonly[readonly Node[], bigint|undefined] => {
        if (state.length === 0) { return [[], undefined] }
        let h = state[state.length - 1][1]
        let nodes: readonly Node[] = []
        for (let i = state.length - 2; i >= 0; i--) {
            const lHash = state[i][1]
            const newH = compress(lHash, h)
            nodes = [...nodes, [lHash, h, newH]]
            h = newH
        }
        return [nodes, h]
    }

    return { push, end }
}
