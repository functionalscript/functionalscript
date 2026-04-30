import type { StateScan } from '../function/operator/module.f.ts'

/**
 * [left, right, merged]
 */
export type Node<T> = readonly[T, T, T]

export type CreateNode<T> = (a: T, b: T) => T

/**
 * A candidate pair of leaves and their IDs.
 */
export type Candidate<T> = readonly[bigint, T]

export type State<T> = readonly Candidate<T>[]

export type PatriciaTrie<T> = {
    /**
     * Add one sorted leaf. Returns any {@link Node}s completed on this step
     * and the updated right-spine {@link State}.
     */
    readonly push: StateScan<Candidate<T>, State<T>, readonly Node<T>[]>
    /**
     * Flush the remaining candidates after all leaves have been pushed.
     * Returns the final {@link Node}s and the root hash, or `undefined` if
     * no leaves were ever added.
     */
    readonly end: (state: State<T>) => readonly[readonly Node<T>[], T|undefined]
}

/**
 * Builds a Patricia Trie from a lexicographically sorted (ascending or
 * descending) stream of leaves.
 *
 * Merge rule: pop and compress the two rightmost candidates whenever their
 * mutual XOR is smaller than the XOR of the top candidate with the new leaf
 * (i.e. the two are more tightly coupled with each other than with `u`).
 */
export const patriciaTrie = <T>(nodeId: CreateNode<T>): PatriciaTrie<T> => ({
    push: state => c => {
        let nodes: readonly Node<T>[] = []
        let stack: readonly Candidate<T>[] = state
        const [u] = c
        while (stack.length >= 2) {
            const [rLeaf, rId] = stack[stack.length - 1]
            const [lLeaf, lId] = stack[stack.length - 2]
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const h = nodeId(lId, rId)
            nodes = [...nodes, [lId, rId, h]]
            stack = [...stack.slice(0, -2), [rLeaf, h]]
        }
        return [nodes, [...stack, c]]
    },
    end: state => {
        if (state.length === 0) { return [[], undefined] }
        let id = state[state.length - 1][1]
        let nodes: readonly Node<T>[] = []
        for (let i = state.length - 2; i >= 0; i--) {
            const lId = state[i][1]
            const newId = nodeId(lId, id)
            nodes = [...nodes, [lId, id, newId]]
            id = newId
        }
        return [nodes, id]
    }
})
