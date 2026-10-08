/**
 * Type-level API of the persistent set.
 *
 * @module
 */

import type { Stack } from '../../common/monoid/types.ts'

/**
 * A persistent set, laid out as the binary representation of its size: a
 * {@link Stack} of runs whose `Set`s hold exactly `size` elements each, one
 * run per set bit, so a set of `n` elements is at most `log2(n) + 1` runs,
 * and an element is in the set exactly when one of them holds it.
 *
 * Adding an element carries like a binary counter: a one-element `Set` is
 * pushed onto the stack, and every run of the same size on the way is
 * merged into what is carried — `common/monoid`'s `step`. Each element is
 * therefore copied at most once per bit of the size, which amortizes an add
 * to a logarithm where `new Set([...prev, value])` costs the whole set every
 * time.
 */
export type PersistentSet<T> = Stack<ReadonlySet<T>>
