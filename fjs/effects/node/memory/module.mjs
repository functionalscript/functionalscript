/**
 * Node.js interpreter helpers for memory effects.
 *
 * @module
 *
 * @import { Key } from '../../memory/types.ts'
 * @import { MemoryOperationMap, MemoryRun, Uuid } from './types.ts'
 */

import { randomUUID } from 'node:crypto'
import { asyncRun } from '../../module.mjs'
import { ok } from '../../../types/result/module.f.js'
import { asNominal, slotId } from '../../memory/module.f.mjs'

/**
 * `slotId` over `store`, throwing its not-found message as an `Error`.
 * @type {(store: Map<string, unknown>) => (key: Key<unknown>) => string}
 */
const storeId = store => key => {
    const r = slotId(id => store.has(id))(key)
    if (r[0] === 'error') { throw new Error(r[1]) }
    return r[1]
}

/**
 * Creates a stateful operation map backed by an immutable `Map` snapshot.
 *
 * Each returned operation map owns its own store. Reusing the same map across
 * multiple `asyncRun` calls preserves memory across those calls; creating a new
 * map starts with an empty store. Keys are generated with `crypto.randomUUID()`
 * by default.
 * @type {(uuid?: Uuid) => MemoryOperationMap}
 */
export const asyncMemoryOperationMap = (uuid = randomUUID) => {
    /** @type {Map<string, unknown>} */
    const store = new Map()
    const slot = storeId(store)
    return {
        memCreate: async value => {
            const id = uuid()
            /** @type {Key<unknown>} */
            const key = asNominal(id)
            store.set(id, value)
            return ok(key)
        },
        memRead: async key => ok(store.get(slot(key))),
        memWrite: async (key, value) => {
            store.set(slot(key), value)
            return ok(undefined)
        },
    }
}

/**
 * Creates a runner owning a fresh memory store. Every effect passed to the
 * *same* runner shares that store; a new runner starts empty.
 *
 * **The `MemoryRun` annotation is what types the `asyncRun` call.** `asyncRun`
 * takes a `ToAsyncOperationMap<O>`, a mapped type keyed on `O[0]`, and
 * TypeScript cannot infer `O` back out of one — only a homomorphic
 * `{[K in keyof T]: …}` is reversed. Left to argument inference `O` falls back
 * to its `Operation` constraint, whose payloads and outputs are `never`, and no
 * real map is assignable to that; the call site then needs a cast. Annotating
 * the result instead lets `O` be inferred from the return type, which is what
 * gives the call a real `O` to check the argument against.
 *
 * **What that check is worth here is narrow, so it is worth stating exactly.**
 * Each handler is already checked against `MemOp` by
 * {@link asyncMemoryOperationMap}'s own annotation, and was before this call was
 * written — a drifted handler is reported there, at the factory, either way.
 * What the runner adds is agreement between the *declared map type* and
 * `MemOp`: give `MemoryOperationMap` a narrower operation set and this line
 * reports the missing handler, where an unchecked call site would leave it to
 * whoever spreads the map next. The wider hazard — a cast stripping the
 * contextual type from an object *literal*, so no handler is checked at all —
 * is `runNodeEffect`'s (`../module.mjs`), which passes a literal; this call
 * passes an already-annotated result.
 * @type {(uuid?: Uuid) => MemoryRun}
 */
export const memoryRun = (uuid = randomUUID) => asyncRun(asyncMemoryOperationMap(uuid))

/**
 * Runs a memory-only effect using a fresh memory store — a store per call, so
 * nothing written by one `run` is visible to the next. Use {@link memoryRun}
 * to keep one.
 * @type {MemoryRun}
 */
export const run = effect => memoryRun()(effect)
