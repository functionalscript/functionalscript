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
 * How long a run may hold the thread before handing it back, in milliseconds.
 *
 * It is a *frame* budget rather than a count of proofs, and that difference is
 * the whole point. A count cannot know what it costs: twenty-five trivial
 * leaves are nothing and twenty-five heavy ones are still a freeze, which is
 * why the number this replaces was indefensible. 8 ms is what a 60 Hz frame
 * leaves for script, so a page that respects it gets a paint slot at the rate
 * it can actually use one, whatever its proofs happen to cost.
 */
const frameBudget = 8

/**
 * Hands control back to the host's event loop and comes back in a later task.
 *
 * Not `setTimeout`: it clamps to 4 ms once nested, and this is called between
 * leaves, so the clamp would add minutes to a suite of a few thousand. That
 * clamp is what pushed an earlier attempt to `MessageChannel` and then into a
 * failure under bun, which drains port messages before running a due timer —
 * a problem this module does not have, because nothing but a browser runs it.
 *
 * `scheduler.yield` is the primitive built for exactly this and does not
 * clamp; `MessageChannel` is the same idea by hand where it is missing.
 *
 * @type {() => Promise<unknown>}
 */
const yieldToHost = () => {
    const { scheduler } = /** @type {{ scheduler?: { yield?: () => Promise<void> } }} */ (
        /** @type {unknown} */ (globalThis))
    if (scheduler?.yield !== undefined) { return scheduler.yield() }
    return new Promise(resolve => {
        const { port1, port2 } = new MessageChannel()
        port1.onmessage = () => {
            port1.close()
            resolve(undefined)
        }
        port2.postMessage(undefined)
    })
}

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
    // When this run last gave the thread back, and the yield the leaves over
    // budget are all waiting on. Per runner rather than per module, because the
    // thread is one thing however many runs share it.
    let sliceStart = performance.now()
    /** @type {Promise<unknown> | null} */
    let slice = null
    /**
     * The yield this leaf must wait for, or `null` when the slice has room.
     *
     * **Answering `null` rather than an already-resolved promise is the whole
     * mechanism**, and it took a measurement to learn it. A leaf runs
     * synchronously inside its handler, so `all`'s children start one after
     * another as each previous leaf finishes — which is what makes "has this
     * slice been spent?" a question with a moving answer. Await anything before
     * the leaf, even a resolved promise, and every handler asks the question at
     * the same instant, before any leaf has run: all of them see an empty
     * budget, none of them yields, and the run is one task again.
     *
     * Waiters share one yield instead of each taking a task, and re-ask when it
     * resolves: the first few resume into the fresh slice and run inline, and
     * whichever one finds the budget spent again waits for the next.
     *
     * @type {() => Promise<unknown> | null}
     */
    const overBudget = () => {
        if (performance.now() - sliceStart < frameBudget) { return null }
        if (slice === null) {
            slice = yieldToHost().then(() => {
                slice = null
                sliceStart = performance.now()
            })
        }
        return slice
    }
    const core = {
        all: async (/** @type {readonly any[]} */ ...effects) =>
            ok(await Promise.all(effects.map(run))),
        // **The leaf is where a browser run yields, and it has to be.** `all`
        // starts every child before awaiting any — a contract, not an
        // implementation detail — so it cannot pause between them without
        // hanging a graph whose child waits on a later sibling. That leaves the
        // leaf: it is the one point every unit of work passes through, and it
        // holds no sibling's answer while it waits.
        //
        // Without this the whole suite runs as one task. Leaves resolve through
        // microtasks, and a microtask drain never returns to the event loop, so
        // a page cannot paint a result, service a timer or answer a click from
        // the first proof to the last — measured at ~53 s on this repo's own
        // browser suite, long enough for the browser to offer to kill the page.
        sandbox: async (/** @type {() => unknown} */ f) => {
            let wait = overBudget()
            while (wait !== null) {
                await wait
                wait = overBudget()
            }
            return ok(await sandbox(f))
        },
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
    // `extra` is read **once**, and the check and the map are built from that
    // one reading. Enumerating is a user-observable operation — a proxy decides
    // what it answers, and may answer differently the second time — so a check
    // that read it again could approve a map the runner does not build, which
    // is the same mistake the page made about proof exports.
    //
    // The handlers are carried over by descriptor rather than by spread, so a
    // map that declares one non-enumerable keeps it. `match` looks a handler up
    // with `getOwnPropertyDescriptor`, so this runner accepts exactly what the
    // layer's dispatch already accepts — no more, and no less. An inherited
    // handler is out of contract there and stays out of contract here.
    const handlers = Object.getOwnPropertyDescriptors(extra)
    const claimed = Object.keys(handlers).filter(k => Object.hasOwn(core, k))
    if (claimed.length !== 0) {
        throw `browserRun: ${claimed.join(', ')} already implemented`
    }
    run = asyncRun(/** @type {any} */ (Object.defineProperties({ ...core }, handlers)))
    return run
}
