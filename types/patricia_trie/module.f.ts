import type { StateScan } from '../function/operator/module.f.ts'

export type Create<S, T> = (storage: S, a: T, b: T) => readonly[S, T]

export type Candidate<T> = readonly[bigint, T]

export type State<T> = readonly Candidate<T>[]

export type PatriciaTrie<S, T> = {
    readonly push: (storage: S) => StateScan<Candidate<T>, State<T>, S>
    readonly end: (storage: S) => (state: State<T>) => readonly[S, T | undefined]
}

export const patriciaTrie = <S, T>(create: Create<S, T>): PatriciaTrie<S, T> => ({
    push: storage => state => c => {
        let s = storage
        let stack: readonly Candidate<T>[] = state
        const [u] = c
        while (stack.length >= 2) {
            const [rLeaf, rHash] = stack[stack.length - 1]
            const [lLeaf, lHash] = stack[stack.length - 2]
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const [newS, h] = create(s, lHash, rHash)
            s = newS
            stack = [...stack.slice(0, -2), [rLeaf, h]]
        }
        return [s, [...stack, c]]
    },
    end: storage => state => {
        if (state.length === 0) { return [storage, undefined] }
        let s = storage
        let h = state[state.length - 1][1]
        for (let i = state.length - 2; i >= 0; i--) {
            const lHash = state[i][1]
            const [newS, newH] = create(s, lHash, h)
            s = newS
            h = newH
        }
        return [s, h]
    }
})
