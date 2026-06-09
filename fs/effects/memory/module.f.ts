/**
 * Typed key-value memory effects for state that persists across effect steps.
 *
 * A memory key is opaque at runtime and carries the value type at compile time,
 * so a key returned by {@link create} can only be read and written with values
 * of the same type. The concrete interpreter owns the actual storage and key
 * generation strategy.
 *
 * Memory effects compose with other effects by unioning operation types, for
 * example `Effect<IoOp | MemOp, T>` for a program that performs both I/O and
 * memory operations.
 *
 * @module
 */

import type { Phantom } from '../../types/phantom/module.f.ts'
import type { Nominal } from '../../types/nominal/module.f.ts'
import { doFull, pure, type Effect } from '../module.f.ts'

/** Opaque handle for a value stored by the memory interpreter. */
export type Key<T> = Phantom<Nominal<'MemKey', 'key', string>, T>

/** Allocates a fresh memory slot and initializes it with `value`. */
export type MemCreate<T> = readonly['memCreate', (value: T) => Key<T>]

/** Reads the current value stored at `key`. */
export type MemRead<T> = readonly['memRead', (key: Key<T>) => T]

/** Replaces the current value stored at `key`. */
export type MemWrite<T> = readonly['memWrite', (key: Key<T>, value: T) => void]

/**
 * All memory operations.
 *
 * Use this union when describing an interpreter that can handle memory effects
 * or when composing memory with another operation set, for example
 * `Effect<NodeOp | MemOp, T>`.
 */
export type MemOp = MemCreate<any> | MemRead<any> | MemWrite<any>

/** Creates a new typed memory slot with `value` as its initial contents. */
export const create = <T>(value: T): Effect<MemCreate<T>, Key<T>> =>
    doFull('memCreate', [value], pure)

/** Reads the current contents of a typed memory slot. */
export const read = <T>(key: Key<T>): Effect<MemRead<T>, T> =>
    doFull('memRead', [key], pure)

/** Replaces the current contents of a typed memory slot. */
export const write = <T>(key: Key<T>, value: T): Effect<MemWrite<T>, void> =>
    doFull('memWrite', [key, value], pure)
