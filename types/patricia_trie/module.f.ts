export type Create<S, T> = (a: T, b: T, storage: S) => readonly[T, S]

export type Candidate<T> = readonly[bigint, T]

export type State<S, T> = readonly[S, readonly Candidate<T>[]]

export type PatriciaTrie<S, T> = {
    readonly push: (c: Candidate<T>, state: State<S, T>) => State<S, T>
    readonly end: (state: State<S, T>) => readonly[T | undefined, S]
}

export const patriciaTrie = <S, T>(create: Create<S, T>): PatriciaTrie<S, T> => ({
    push: (c, [storage, stack]) => {
        const [u] = c
        while (stack.length >= 2) {
            const [rLeaf, rHash] = stack[stack.length - 1]
            const [lLeaf, lHash] = stack[stack.length - 2]
            if ((lLeaf ^ rLeaf) >= (rLeaf ^ u)) { break }
            const [h, newS] = create(lHash, rHash, storage)
            storage = newS
            stack = [...stack.slice(0, -2), [rLeaf, h]]
        }
        return [storage, [...stack, c]]
    },
    end: ([storage, stack]) => {
        if (stack.length === 0) { return [undefined, storage] }
        let h = stack[stack.length - 1][1]
        for (let i = stack.length - 2; i >= 0; i--) {
            const lHash = stack[i][1];
            [h, storage] = create(lHash, h, storage)
        }
        return [h, storage]
    }
})
