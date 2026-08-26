/**
 * Node.js interpreter helpers for memory effects.
 *
 * @module
 *
 * @import { Effect, ToAsyncOperationMap } from '../../types.ts'
 * @import { Result } from '../../../types/result/types.ts'
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
 * An {@link asyncRun} runner over {@link MemOp}: an effect in, its `Result` out.
 * @typedef {<T, E>(effect: Effect<MemOp, T, E>) => Promise<Result<T, E>>} MemoryRun
 */

/**
 * Creates a runner owning a fresh memory store. Every effect passed to the
 * *same* runner shares that store; a new runner starts empty.
 *
 * **The `MemoryRun` annotation is what types the `asyncRun` call.** `asyncRun`
 * takes a `ToAsyncOperationMap<O>`, a mapped type keyed on `O[0]`, and
 * TypeScript cannot infer `O` back out of one — only a homomorphic
 * `{[K in keyof T]: …}` is reversed. Left to argument inference `O` falls back
 * to its `Operation` constraint, whose payloads and outputs are `never`, and no
 * real map is assignable to that; the call site then needs a cast, and a cast in
 * *that* position stops each handler from being checked against `O` at all (see
 * [`fjs/AGENTS.md`](../../../AGENTS.md)). Annotating the result instead lets
 * `O` be inferred from the return type, so the map stays checked. The Node
 * runner pins `runNodeEffect` the same way (`../module.mjs`).
 * @type {(uuid?: Uuid) => MemoryRun}
 */
export const memoryRun = (uuid = randomUUID) => asyncRun(memoryOperationMap(uuid))

/**
 * Runs a memory-only effect using a fresh memory store — a store per call, so
 * nothing written by one `run` is visible to the next. Use {@link memoryRun}
 * to keep one.
 * @type {MemoryRun}
 */
export const run = effect => memoryRun()(effect)
