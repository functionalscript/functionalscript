/**
 * Types for typed key-value memory effects.
 *
 * @module
 */

import type { Phantom } from '../../types/phantom/types.ts'
import type { Nominal } from '../../types/nominal/types.ts'

/** Nominal brand version for memory keys. */
export type _MemKeyHash = '3f114fa6036a8da026b827f0c3e6d901f5e81ad9a320e431ccce31451892d286'

/** Opaque handle for a value stored by the memory interpreter. */
export type Key<T> = Phantom<Nominal<'MemKey', _MemKeyHash, string>, T>

/** Allocates a fresh memory slot and initializes it with `value`. */
export type MemCreate = readonly['memCreate', <T>(value: T) => Key<T>]

/** Reads the current value stored at `key`. */
export type MemRead = readonly['memRead', <T>(key: Key<T>) => T]

/** Replaces the current value stored at `key`. */
export type MemWrite = readonly['memWrite', <T>(key: Key<T>, value: T) => void]

export type MemOp = MemCreate | MemRead | MemWrite
