/**
 * Type-level API of the persistent set.
 *
 * @module
 */

/**
 * A persistent set, laid out as the binary representation of its size: the
 * entry at index `k` holds exactly `2^k` elements or is `null`, so a set of
 * `n` elements is at most `log2(n) + 1` entries, and an element is in the
 * set exactly when one of them holds it.
 *
 * Adding an element carries like a binary counter: a one-element `Set` goes
 * into the first empty entry, and every full entry on the way there is
 * merged into what is carried. Each element is therefore copied at most
 * once per bit of the size, which amortizes an add to a logarithm where
 * `new Set([...prev, value])` costs the whole set every time.
 */
export type PersistentSet<T> = readonly (ReadonlySet<T> | null)[]
