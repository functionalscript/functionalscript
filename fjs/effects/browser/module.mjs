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
 * @import { Effect, Operation, ToAsyncOperationMap } from '../types.ts'
 * @import { All, Catch, Sandbox } from '../node/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { asyncRun } from '../module.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { tryCatch } from '../../types/result/module.mjs'

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
 * `extra` is a **complete** map of the operations it names, not a partial one.
 * `asyncRun` dispatches by exact match and panics on a command no handler
 * claims, so a type that accepted holes would promise a recovery this runner
 * does not perform — an omitted handler rejects the run's promise rather than
 * answering `NotImplemented` through the error channel. A host that wants a
 * hole to be an ordinary outcome builds its runner on `partialMatch`, the way
 * `effects/mock` does.
 *
 * The runner it answers keeps the effect's own types: a caller reads the
 * `Result` it resolves with rather than casting one out of `unknown`. The
 * operations are the three below plus `extra`'s, which is what makes an effect
 * this runner cannot dispatch a type error rather than a rejected promise.
 *
 * @template {Operation} O
 * @param {ToAsyncOperationMap<O>} extra
 * @returns {<T, E>(effect: Effect<O | All | Catch | Sandbox, T, E>) => Promise<Result<T, E>>}
 */
export const browserRun = extra => {
    // `all` interprets its children with the runner being defined, so the loop
    // is tied through a self-reference and the map cannot be typed on the way
    // in. The cast stops at the `asyncRun` call: what the function answers is
    // typed.
    /** @type {(effect: any) => Promise<any>} */
    let run
    const core = {
        all: async (/** @type {readonly any[]} */ ...effects) =>
            ok(await Promise.all(effects.map(run))),
        sandbox: async (/** @type {() => unknown} */ f) => ok(await sandbox(f)),
        // No clock and no fixture convention — see `Catch` in
        // `../node/types.ts` for why this is a second operation beside
        // `sandbox` rather than a use of it. It is `tryCatch`, spelled the
        // same way `effects/node` spells it: that helper carries no host
        // dependency, so there is nothing here for a browser to do
        // differently.
        catch: async (/** @type {() => unknown} */ f) => ok(tryCatch(f)),
    }
    // A collision panics rather than being resolved in either direction. The
    // runner's answer is typed by these three operations, so an `extra` that
    // replaced one would make the type a lie — and silently letting the core
    // win instead would discard a handler the caller wrote on purpose. Neither
    // is a routine outcome: it is a program claiming an operation this runner
    // already has, which is the same class of bug as asking for one it does
    // not.
    const claimed = Object.keys(extra).filter(k => Object.hasOwn(core, k))
    if (claimed.length !== 0) {
        throw `browserRun: ${claimed.join(', ')} already implemented`
    }
    run = asyncRun(/** @type {any} */ ({ ...core, ...extra }))
    return run
}
