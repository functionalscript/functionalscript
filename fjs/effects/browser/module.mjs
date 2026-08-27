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
 * How many effects one `all` starts before it hands the event loop back.
 *
 * **A browser needs a real task boundary to paint, and only `all` can give it
 * one.** Every operation resolves through a microtask, so a page running a
 * suite of any size would show its first frame until the last proof body had
 * finished — `all` starts every child in the same turn, and a child that yielded
 * inside its own continuation would pause only itself while its siblings ran on.
 * Slicing the children is what bounds the work between two frames.
 *
 * `all` promises that its effects run concurrently and that it answers each
 * one's whole `Result`. Neither says they start simultaneously, so the slicing
 * is the runner's business — the Node runner has no frame to paint and starts
 * them all at once.
 *
 * Yielding per effect would be the simpler rule and the wrong one: `setTimeout`
 * clamps to 4 ms once nested, which is minutes across a few thousand proofs.
 */
const batchSize = 25

/** @type {() => Promise<void>} */
const macrotask = () => new Promise(resolve => { setTimeout(resolve, 0) })

/**
 * Runs `effects` in slices of {@link batchSize}, yielding to the event loop
 * between them, and answers every `Result` in the order the effects were given.
 *
 * @template T
 * @template E
 * @param {CommonRun} run
 * @param {readonly Effect<CommonOp, T, E>[]} effects
 * @returns {Promise<readonly Result<T, E>[]>}
 */
const runBatched = async (run, effects) => {
    /** @type {readonly Result<T, E>[]} */
    let done = []
    let index = 0
    while (index < effects.length) {
        const batch = await Promise.all(effects.slice(index, index + batchSize).map(e => run(e)))
        done = [...done, ...batch]
        index += batchSize
        if (index < effects.length) { await macrotask() }
    }
    return done
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
    all: async (...effects) => ok(await runBatched(run, effects)),
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
    now: async () => ok(Date.now()),
    sandbox: async f => ok(await sandbox(f)),
})
