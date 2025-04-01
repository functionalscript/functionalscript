const concat = <T>(x: Iterable<T>, y: Iterable<T>): Iterable<T> => ({
    *[Symbol.iterator]() {
        yield* x
        yield* y
    }
})

const filter = <T>(i: Iterable<T>, p: (x: T) => boolean): Iterable<T> => ({
    *[Symbol.iterator]() {
        for (const x of i) {
            if (p(x)) { yield x }
        }
    }
})

export const mapSet = <K, V>(map: ReadonlyMap<K, V>, k: K, v: V): ReadonlyMap<K, V> =>
    new Map(concat(map, [[k, v]]))

export const mapDelete = <K, V>(map: ReadonlyMap<K, V>, k: K): ReadonlyMap<K, V> =>
    new Map(filter(map, ([xk]) => xk !== k))
