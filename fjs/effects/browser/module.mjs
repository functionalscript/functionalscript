/**
 * A browser interpreter for the host-independent operations.
 *
 * It implements exactly three — `sandbox`, which calls a function and reports
 * what happened instead of throwing; `catch`, which does the same for a pure
 * thunk with no clock; and `all`, which performs its children concurrently.
 * None of them names a browser API beyond `performance.now` and `Promise`:
 * these are the same operations `effects/node` performs, and this module is the
 * "follow the example" reading of its interpreter rather than a second design.
 *
 * **Three is the whole set, and that is a measurement rather than a starting
 * point.** The shared proof traversal (`emergent_testing/module.f.mjs`)
 * performs `sandbox`, `catch`, `all`, and whatever its reporter performs.
 * `await` belongs to the *registration* path, which external frameworks drive
 * and this one does not; a page loads its modules through its own importer
 * rather than through an `import` operation; and a browser run measures its own
 * wall clock rather than dispatching `now`. So `await`, `import`, `fetch` and
 * `now` have no second implementer here — which is the fact
 * `emergent_testing/todo/share-browser-console-runner.md` step 4 was waiting to
 * learn before moving anything out of `effects/node`.
 *
 * The module has no Node dependencies: a page imports it directly as an ES
 * module.
 *
 * @module
 *
 * @import { Operation, OperationMap } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { asyncRun } from '../module.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/**
 * Calls `f` and answers what happened — its value, or the value it threw —
 * together with how long it took.
 *
 * This is the boundary that keeps a host value out of the pure traversal: the
 * `try`/`catch` and the clock live here, and the core receives a
 * `SandboxResult` it can read without knowing which host produced it.
 *
 * A returned promise is awaited and the clock read again after it settles, so
 * an asynchronous leaf is timed by what it did rather than by how quickly it
 * handed back a promise. Authored FunctionalScript has no promises, so this is
 * a guard rather than a path anything is expected to take — the same one
 * `effects/node` keeps, spelled the same way, because two runners that
 * disagreed about an awaited leaf would not be one runner.
 *
 * @template T
 * @param {() => T} f
 * @returns {Promise<{ readonly result: Result<T, unknown>, readonly duration: number }>}
 */
const sandbox = async f => {
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
 * A browser effect runner for `sandbox`, `catch` and `all`, plus whatever
 * `extra` operations the application adds — a page's own reporting, typically.
 *
 * `all` starts every child before awaiting any, which is a contract rather than
 * an implementation detail: a child may wait on something a later sibling
 * produces, so an interpreter that awaited one before starting the next would
 * hang a graph the node runner completes. It answers in argument order however
 * the children interleave, which is what lets the shared traversal report in
 * structural order.
 *
 * @type {<O extends Operation>(extra: Partial<OperationMap<O, unknown>>) => (effect: unknown) => Promise<unknown>}
 */
export const browserRun = extra => {
    /** @type {(effect: any) => Promise<any>} */
    const run = asyncRun(/** @type {any} */ ({
        all: async (/** @type {readonly any[]} */ ...effects) =>
            ok(await Promise.all(effects.map(run))),
        sandbox: async (/** @type {() => unknown} */ f) => ok(await sandbox(f)),
        // No clock and no fixture convention — see `Catch` in
        // `../node/types.ts` for why this is a second operation beside
        // `sandbox` rather than a use of it.
        catch: async (/** @type {() => unknown} */ f) => {
            try {
                return ok(ok(f()))
            } catch (e) {
                return ok(error(e))
            }
        },
        ...extra,
    }))
    return run
}
