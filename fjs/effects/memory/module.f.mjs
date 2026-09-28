/**
 * Typed key-value memory effects for state that persists across effect steps.
 *
 * A memory key is opaque at runtime and carries the value type at compile time,
 * so a key returned by {@link create} can only be read and written with values
 * of the same type. The concrete interpreter owns the actual storage and key
 * generation strategy: {@link memoryOperationMap} is the synchronous one, for
 * `../mock`'s `run`, and `../node/memory` the asynchronous one.
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
 * @import { MemOperationMap } from '../mock/types.ts'
 * @import { Key, MemCreate, MemOp, MemRead, MemWrite, MemoryState, _MemKeyHash } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { asBase as nominalAsBase, asNominal as nominalAsNominal } from '../../types/nominal/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { do_ } from '../module.f.mjs'

const { hasOwn } = Object

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

/**
 * The storage of a run that has created nothing yet.
 *
 * @type {MemoryState}
 */
export const memoryInitial = { next: 0, values: {} }

/**
 * The key a slot is stored under, which the caller must have been handed by
 * `memCreate`. A key it never handed out is a caller bug, so reading or
 * writing one panics with the sentence the asynchronous interpreter
 * (`../node/memory`) uses, rather than answering `ok(undefined)` and turning
 * the bug into whatever the value's first reader does with `undefined`.
 * Presence is the test, not the value: `memCreate(undefined)` is legal.
 *
 * @type {(values: MemoryState['values']) => (key: Key<unknown>) => string}
 */
const slot = values => key => {
    const id = asBase(key)
    assert(hasOwn(values, id), `memory key not found: ${id}`)
    return id
}

/**
 * The synchronous memory interpreter: keys are `mem0`, `mem1`, … in creation
 * order, and the storage is {@link MemoryState}. A runner whose state holds
 * more than memory delegates to it over its memory field.
 *
 * @type {MemOperationMap<MemOp, MemoryState>}
 */
export const memoryOperationMap = {
    memCreate: value => ({ next, values }) => {
        const id = `mem${next}`
        /** @type {Key<unknown>} */
        const key = asNominal(id)
        return [{ next: next + 1, values: { ...values, [id]: value } }, ok(key)]
    },
    memRead: key => state => [state, ok(state.values[slot(state.values)(key)])],
    memWrite: (key, value) => ({ next, values }) =>
        [{ next, values: { ...values, [slot(values)(key)]: value } }, ok(undefined)],
}
