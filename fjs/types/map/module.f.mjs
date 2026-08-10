/**
 * Persistent map operations built on ordered collections.
 *
 * @module
 */

/**
 * @template T
 * @param {Iterable<T>} x
 * @param {Iterable<T>} y
 * @returns {Iterable<T>}
 */
const concat = (x, y) => ({
    *[Symbol.iterator]() {
        yield* x
        yield* y
    }
})

/**
 * @template T
 * @param {Iterable<T>} i
 * @param {(x: T) => boolean} p
 * @returns {Iterable<T>}
 */
const filter = (i, p) => ({
    *[Symbol.iterator]() {
        for (const x of i) {
            if (p(x)) { yield x }
        }
    }
})

/**
 * @type {<K, V>(map: ReadonlyMap<K, V>, k: K, v: V) => ReadonlyMap<K, V>}
 */
export const mapSet = (map, k, v) => new Map(concat(map, [[k, v]]))

/**
 * @type {<K, V>(map: ReadonlyMap<K, V>, k: K) => ReadonlyMap<K, V>}
 */
export const mapDelete = (map, k) => new Map(filter(map, ([xk]) => xk !== k))
