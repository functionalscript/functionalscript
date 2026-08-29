/**
 * Host implementations of the operations more than one host implements.
 *
 * The declarations live in [`./module.f.mjs`](./module.f.mjs); these are the
 * handlers a real runner dispatches them to. They need `try`/`catch` and a
 * clock, so they are impure `.mjs` — but nothing in them is any *particular*
 * host's: `performance.now()` and a `try` are what a browser has too. Keeping
 * them here is what stops the second host from writing a second copy.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Catch, Sandbox, SandboxResult } from './types.ts'
 * @import { ToAsyncOperationMap } from '../types.ts'
 */

import { error, ok } from '../../types/result/module.f.mjs'
import { tryCatch } from '../../types/result/module.mjs'

/**
 * Runs `f`, answering what it did and how long it took.
 *
 * **The clock reads bracket the call and nothing else.** A caller timing this
 * from outside would measure the dispatch as well, and each host dispatches
 * differently — which is the reason `sandbox` is one operation rather than a
 * `Perf` around a `TryCatch`.
 *
 * A returned promise is awaited and the clock read again, so an async test is
 * measured to where it settled rather than to where it returned a promise.
 *
 * @template T
 * @param {() => T} f
 * @returns {Promise<SandboxResult<T>>}
 */
export const sandbox = async f => {
    /** @type {Result<T, unknown>} */
    let result
    let after
    const before = performance.now()
    try {
        let p = f()
        after = performance.now()
        if (p instanceof Promise) {
            p = await p
            after = performance.now()
        }
        result = ok(p)
    } catch (e) {
        after = performance.now()
        result = error(e)
    }
    return { result, duration: after - before }
}

/**
 * The two handlers, ready to be spread into a host's own operation map.
 *
 * A host adds what it can do to what every host can do, rather than restating
 * the second half. `../node` spreads this; a browser interpreter will spread
 * the same object, which is the point of it being an object.
 *
 * @type {ToAsyncOperationMap<Catch | Sandbox>}
 */
export const commonOperationMap = {
    sandbox: async f => ok(await sandbox(f)),
    // A pure thunk over a value the program already has: no clock, no fixture
    // convention, just "did it throw". See `Catch` in ./types.ts.
    catch: async f => ok(tryCatch(f)),
}
