/**
 * Node.js interpreter helpers for memory effects.
 *
 * @module
 *
 * @import { Effect, ToAsyncOperationMap } from '../../types.ts'
 * @import { Key, MemOp } from '../../memory/types.ts'
 */

import { randomUUID } from 'node:crypto'
import { asyncRun } from '../../module.mjs'
import { ok } from '../../../types/result/module.f.mjs'
import { asBase, asNominal } from '../../memory/module.f.mjs'

/** @typedef {ToAsyncOperationMap<MemOp>} MemoryOperationMap */

/** @typedef {() => string} Uuid */

/** @type {(id: string) => Error} */
const missingKey = id =>
    new Error(`memory key not found: ${id}`)

/**
 * Creates a stateful operation map backed by an immutable `Map` snapshot.
 *
 * Each returned operation map owns its own store. Reusing the same map across
 * multiple `asyncRun` calls preserves memory across those calls; creating a new
 * map starts with an empty store. Keys are generated with `crypto.randomUUID()`
 * by default.
 * @type {(uuid?: Uuid) => MemoryOperationMap}
 */
export const memoryOperationMap = (uuid = randomUUID) => {
    /** @type {Map<string, unknown>} */
    const store = new Map()
    return {
        memCreate: async value => {
            const id = uuid()
            /** @type {Key<unknown>} */
            const key = asNominal(id)
            store.set(id, value)
            return ok(key)
        },
        memRead: async key => {
            const id = asBase(key)
            if (!store.has(id)) { throw missingKey(id) }
            return ok(store.get(id))
        },
        memWrite: async (key, value) => {
            const id = asBase(key)
            if (!store.has(id)) { throw missingKey(id) }
            store.set(id, value)
            return ok(undefined)
        },
    }
}

/**
 * Runs a memory-only effect using a fresh memory store.
 * @type {<T>(effect: Effect<MemOp, T>) => Promise<T>}
 */
export const run = effect =>
    asyncRun(/** @type {ToAsyncOperationMap<MemOp>} */ (memoryOperationMap()))(effect)
