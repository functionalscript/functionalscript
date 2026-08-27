/**
 * Browser effect runner: interprets the host-independent operations
 * (`../common/types.ts`) against a browser realm.
 *
 * It is the browser's counterpart of [`../node/module.mjs`](../node/module.mjs)
 * and deliberately implements **only** `CommonOp`. There is no browser
 * filesystem, no subprocess and no stdout to interpret, and inventing browser
 * spellings for those would describe a host that does not exist; a page needing
 * something of its own — a DOM to render into, a report to publish — composes
 * its handlers on top of this map rather than finding them in it.
 *
 * The module has no Node dependency of any kind, so a page links it as an
 * ordinary ES module with no bundling or transpilation.
 *
 * @module
 *
 * @import { Effect, ToAsyncOperationMap } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { CommonOp, Module } from '../common/types.ts'
 */

import { awaitPromise, io, sandbox } from '../common/module.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { toVec } from '../../types/uint8array/module.f.mjs'

/**
 * An effect runner over the operations this map is spread into. `all` runs its
 * children through it rather than through a runner of its own, so an effect
 * nested inside `all` reaches every handler the caller composed — not just the
 * common ones.
 *
 * @typedef {<T, E>(effect: Effect<CommonOp, T, E>) => Promise<Result<T, E>>} CommonRun
 */

/**
 * Links a module in the page's realm. Injected so a caller can report loading
 * progress, resolve a specifier against an application root, or drive the
 * runner from a proof without a network; the default is the realm's own
 * dynamic `import`.
 *
 * @typedef {(source: string) => Promise<Module>} BrowserImporter
 */

/**
 * Hands the event loop back, so the browser gets a turn.
 *
 * **Not `setTimeout`.** It clamps to 4 ms once nested, and a yield between every
 * launch across a few thousand proofs is then minutes of pure clamp — measured
 * at 58 s against 40 s on the real suite. That cost is what once made grouping
 * the launches look necessary. A `MessageChannel` message is an ordinary task
 * with no clamp, so the same per-launch yield costs about 3%.
 *
 * @type {() => Promise<void>}
 */
const yieldToLoop = () => new Promise(resolve => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => { port1.close(); resolve(undefined) }
    port2.postMessage(0)
})

/**
 * Starts every effect, handing the event loop back between one launch and the
 * next, and answers each `Result` in the order the effects were given.
 *
 * **A browser needs a real task boundary to paint, and only `all` can give it
 * one.** Every operation resolves through a microtask, and a browser cannot
 * paint between microtasks, so without this the whole suite is a single task:
 * measured on the real suite, the first result appears at 39.8 s of a 39.7 s
 * run — nothing at all until the end, and no faster for it. What a launch does
 * is exactly the work worth bounding, because a proof body runs synchronously
 * inside `sandbox` before that handler's first `await`.
 *
 * **Every effect is started before any is awaited**, which is not a detail.
 * `all` promises its children run concurrently, and awaiting one before
 * starting the next would break that promise rather than delay it: a child
 * waiting on something a later sibling produces would wait for a sibling that
 * is never started, and the run would hang with no report — on a graph the Node
 * runner completes. `all` says its children run concurrently and that it
 * answers every `Result`; it does not say they start in the same task, which is
 * what leaves the scheduling to the runner. The Node runner has no frame to
 * paint and starts them all at once.
 *
 * There is deliberately **no batch size**. Grouping launches was a workaround
 * for `setTimeout`'s clamp, and a count is the wrong measure anyway — proofs
 * differ in cost by orders of magnitude, so a group of ten fast ones wastes a
 * boundary while a group holding one slow one stalls regardless. With an
 * unclamped yield there is no constant left to tune.
 *
 * @template T
 * @template E
 * @param {CommonRun} run
 * @param {readonly Effect<CommonOp, T, E>[]} effects
 * @returns {Promise<readonly Result<T, E>[]>}
 */
const runYielding = async (run, effects) => {
    /** @type {readonly Promise<Result<T, E>>[]} */
    let started = []
    for (const effect of effects) {
        if (started.length !== 0) { await yieldToLoop() }
        started = [...started, run(effect)]
    }
    return Promise.all(started)
}

/**
 * The browser's handlers for the host-independent operations.
 *
 * `run` is the composed runner the caller builds — the one that also knows the
 * caller's own operations — so `all` schedules its children through it. Passing
 * it in rather than closing over a runner defined here is what keeps this map
 * composable: a page adds handlers, and the effects nested inside `all` still
 * reach them.
 *
 * @type {(run: CommonRun, importer?: BrowserImporter) => ToAsyncOperationMap<CommonOp>}
 */
export const browserOperationMap = (run, importer = source => import(source)) => ({
    all: async (...effects) => ok(await runYielding(run, effects)),
    await: async p => ok(await awaitPromise(p)),
    fetch: url => io(async () => {
        const response = await globalThis.fetch(url)
        if (!response.ok) {
            throw new Error(`Fetch error: ${response.status} ${response.statusText}`)
        }
        return toVec(new Uint8Array(await response.arrayBuffer()))
    }),
    // A synchronous throw from the importer — a specifier the realm rejects
    // before it ever starts loading — is a load failure like any other, so it
    // is caught here rather than escaping the effect it belongs to.
    import: path => io(async () => importer(path)),
    // `performance.timeOrigin + performance.now()`, not `Date.now()`. The
    // operation means the same thing either way — milliseconds since the epoch,
    // as the Node runner answers — but this one cannot go backwards. A suite
    // runs for minutes, an NTP correction lands inside one, and the report's
    // duration is the difference between two of these reads: with wall-clock
    // time that difference can come out negative or inflated, which is what the
    // deleted browser runner avoided by measuring in `performance.now()`.
    now: async () => ok(performance.timeOrigin + performance.now()),
    sandbox: async f => ok(await sandbox(f)),
})
