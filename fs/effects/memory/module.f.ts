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
import { type Nominal, asBase as nominalAsBase, asNominal as nominalAsNominal } from '../../types/nominal/module.f.ts'
import { do_, type Effect } from '../module.f.ts'

/** Nominal brand version for memory keys. */
type MemKeyHash = '3f114fa6036a8da026b827f0c3e6d901f5e81ad9a320e431ccce31451892d286'

/** Opaque handle for a value stored by the memory interpreter. */
export type Key<T> = Phantom<Nominal<'MemKey', MemKeyHash, string>, T>

export const asBase = nominalAsBase<'MemKey', MemKeyHash, string>

export const asNominal = nominalAsNominal<'MemKey', MemKeyHash, string>

/** Allocates a fresh memory slot and initializes it with `value`. */
export type MemCreate = readonly['memCreate', <T>(value: T) => Key<T>]

/** Reads the current value stored at `key`. */
export type MemRead = readonly['memRead', <T>(key: Key<T>) => T]

/** Replaces the current value stored at `key`. */
export type MemWrite = readonly['memWrite', <T>(key: Key<T>, value: T) => void]

export type MemOp = MemCreate | MemRead | MemWrite

/** Creates a new typed memory slot with `value` as its initial contents. */
export const create =
    do_('memCreate') as <T>(value: T) => Effect<MemCreate, Key<T>>

/** Reads the current contents of a typed memory slot. */
export const read =
    do_('memRead') as <T>(ket: Key<T>) => Effect<MemRead, T>

/** Replaces the current contents of a typed memory slot. */
export const write: <T>(key: Key<T>, value: T) => Effect<MemWrite, void> =
    do_('memWrite')
