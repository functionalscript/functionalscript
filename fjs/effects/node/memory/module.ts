/**
 * Node.js interpreter helpers for memory effects.
 *
 * @module
 */

import { randomUUID } from 'node:crypto'
import { asyncRun } from '../../module.ts'
import type { Effect, ToAsyncOperationMap } from '../../module.f.ts'
import { asBase, asNominal, type Key, type MemOp } from '../../memory/module.f.ts'

export type MemoryOperationMap = ToAsyncOperationMap<MemOp>

export type Uuid = () => string

const missingKey = (id: string): Error =>
    new Error(`memory key not found: ${id}`)

/**
 * Creates a stateful operation map backed by an immutable `Map` snapshot.
 *
 * Each returned operation map owns its own store. Reusing the same map across
 * multiple `asyncRun` calls preserves memory across those calls; creating a new
 * map starts with an empty store. Keys are generated with `crypto.randomUUID()`
 * by default.
 */
export const memoryOperationMap = (uuid: Uuid = randomUUID): MemoryOperationMap => {
    const store: Map<string, unknown> = new Map()
    return {
        memCreate: async value => {
            const id = uuid()
            const key: Key<unknown> = asNominal(id)
            store.set(id, value)
            return key
        },
        memRead: async key => {
            const id = asBase(key)
            if (!store.has(id)) { throw missingKey(id) }
            return store.get(id)
        },
        memWrite: async (key, value) => {
            const id = asBase(key)
            if (!store.has(id)) { throw missingKey(id) }
            store.set(id, value)
        },
    }
}

/** Runs a memory-only effect using a fresh memory store. */
export const run = <T>(effect: Effect<MemOp, T>): Promise<T> =>
    asyncRun<MemOp>(memoryOperationMap())(effect)
