/**
 * Typed key-value memory effects for state that persists across effect steps.
 *
 * A memory key is opaque at runtime and carries the value type at compile time,
 * so a key returned by {@link create} can only be read and written with values
 * of the same type. The concrete interpreter owns the actual storage and key
 * generation strategy.
 *
 * Memory effects compose with other effects by unioning operation types, for
 * example `Effect<IoOp | MemOp, T, E>` for a program that performs both I/O and
 * memory operations.
 *
 * See `./types.ts` for the `Key`/`MemCreate`/`MemRead`/`MemWrite`/`MemOp`
 * type-level API.
 *
 * @module
 *
 * @import { Nominal } from '../../types/nominal/types.ts'
 * @import { Effect } from '../types.ts'
 * @import { Key, MemCreate, MemRead, MemWrite, _MemKeyHash } from './types.ts'
 */

import { asBase as nominalAsBase, asNominal as nominalAsNominal } from '../../types/nominal/module.f.mjs'
import { do_ } from '../module.f.mjs'

/** @type {(n: Nominal<'MemKey', _MemKeyHash, string>) => string} */
export const asBase = nominalAsBase

/** @type {(b: string) => Nominal<'MemKey', _MemKeyHash, string>} */
export const asNominal = nominalAsNominal

/** Creates a new typed memory slot with `value` as its initial contents. */
export const create =
    /** @type {<T>(value: T) => Effect<MemCreate, Key<T>>} */
    (do_('memCreate'))

/** Reads the current contents of a typed memory slot. */
export const read =
    /** @type {<T>(key: Key<T>) => Effect<MemRead, T>} */
    (do_('memRead'))

/** Replaces the current contents of a typed memory slot. */
/** @type {<T>(key: Key<T>, value: T) => Effect<MemWrite, void>} */
export const write = do_('memWrite')
