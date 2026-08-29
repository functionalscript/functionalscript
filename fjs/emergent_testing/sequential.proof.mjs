/**
 * The shared traversal's sequential contract, observed on a runner that can
 * actually interleave.
 *
 * This proof is `.mjs` rather than `.f.mjs` deliberately, and for a reason the
 * contract itself creates: **a synchronous runner cannot tell the two
 * schedulings apart.** Under `../effects/mock`, `all` is written as a fold that
 * runs each child to completion in turn, so a fanned-out traversal and a
 * sequential one record exactly the same order of events there — a proof
 * written against it would pass whichever the traversal does, which is the
 * coincidence `todo/share-browser-console-runner.md` names as worse than no
 * proof at all. Only a runner with real suspension points shows the
 * difference, and that runner is `../effects/module.mjs`'s `asyncRun`, which
 * belongs in a host file.
 *
 * What the difference looks like: `all` is `Promise.all`, which starts every
 * child before awaiting any, so two leaves that suspend record
 * `start:a, start:b, …` and report only once the whole group has landed. The
 * fold records `start:a, end:a, report:a, start:b, …` — the order these
 * proofs assert, and the order a reader of a running suite sees.
 *
 * @module
 *
 * @import { Effect, Func, OpResult } from '../effects/types.ts'
 * @import { All, Catch, Sandbox } from '../effects/node/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Reporter } from './types.ts'
 */

import { assertEq } from '../asserts/module.f.mjs'
import { do_ } from '../effects/module.f.mjs'
import { asyncRun } from '../effects/module.mjs'
import { ok } from '../types/result/module.f.mjs'
import { defaultTest, runModuleMap } from './module.f.mjs'

/**
 * A leaf that suspends in the middle of its own body.
 *
 * The `await` is the whole point: it is a place another leaf could run if one
 * had been started, so `start` and `end` bracket a window that a concurrent
 * traversal fills and a sequential one leaves empty.
 *
 * @type {(events: string[], name: string) => () => Promise<void>}
 */
const leaf = (events, name) => async () => {
    events.push(`start:${name}`)
    await Promise.resolve()
    events.push(`end:${name}`)
}

/**
 * Runs `moduleMap` through the shared traversal on an asynchronous runner, and
 * answers the events in the order they happened.
 *
 * The log is an array the handlers append to rather than runner state, because
 * `asyncRun` threads none — it is the real interpreter, not a fixture, and
 * that is exactly why this proof uses it.
 *
 * The map is built *from* the log rather than passed alongside it, because the
 * fixture's leaves are what record `start` and `end`: a leaf has to be able to
 * write into the same log its report is written into, or the two halves of the
 * order could not be compared.
 *
 * @type {(
 *     moduleMap: (events: string[]) => Record<string, { readonly proof: unknown }>
 * ) => Promise<string>}
 */
const eventsOf = async moduleMap => {
    // The one operation these fixtures add: append a name to the run's log.
    //
    // The reporter records through an *operation* rather than by appending
    // directly, so that what is ordered is the report the runner performs, at
    // the moment it performs it. A reporter method that appended while its
    // effect was being *built* would time the construction of a continuation
    // instead, which is a different question from the one asked here.
    /** @typedef {readonly['record', (name: string) => OpResult<void>]} _Record */
    /** @type {Func<_Record>} */
    const record = do_('record')
    /** @type {Reporter<Sandbox | _Record>} */
    const reporter = {
        result: t => record(`report:${t.path}`),
        summary: () => record('summary'),
        test: defaultTest,
    }
    /** @type {string[]} */
    const events = []
    /** @type {<T, E>(e: Effect<All | Catch | Sandbox | _Record, T, E>) => Promise<Result<T, E>>} */
    let run
    run = asyncRun({
        // **The runner offers `all`, and the traversal is expected not to ask
        // for it.** Leaving it out would make a restored fan-out fail as an
        // unclaimed command — a true signal, but about the traversal's
        // vocabulary rather than its order. Implemented faithfully instead
        // (`Promise.all` starts every child before awaiting any, exactly as
        // `../effects/node` does), a restored fan-out fails these proofs by
        // interleaving, which is the property they are about.
        all: async (...effects) => ok(await Promise.all(effects.map(run))),
        sandbox: async (/** @type {() => unknown} */ f) => {
            const result = ok(await f())
            return ok({ result, duration: 0 })
        },
        catch: async (/** @type {() => unknown} */ f) => ok(ok(f())),
        record: async (/** @type {string} */ name) => {
            events.push(name)
            return ok(undefined)
        },
    })
    await run(/** @type {Effect<All | Catch | Sandbox | _Record, number, never>} */ (
        runModuleMap(reporter)(moduleMap(events))))
    return events.join(' ')
}

/**
 * Sibling leaves do not overlap: each one's report lands before the next one
 * starts.
 *
 * Delete the fold in `walkEntries` and fan out with `allOk` again, and this is
 * the assertion that fails — `start:a, start:b, end:a, end:b, report:a,
 * report:b` — which is what makes it a proof of the scheduling rather than of
 * the reporting.
 */
const siblingsDoNotOverlap = async () => {
    const events = await eventsOf(e => ({
        './m.proof.f.mjs': { proof: { a: leaf(e, 'a'), b: leaf(e, 'b') } },
    }))
    assertEq(
        events,
        'start:a end:a report:.a start:b end:b report:.b summary',
        events)
}

/**
 * Modules do not overlap either, for the same reason and by the same fold: a
 * module's last leaf is reported before the next module's first one starts.
 *
 * Stated separately because it is a separate fan-out — `runModuleMap`'s, not
 * `walkEntries`' — and restoring either one alone leaves the other's proof
 * green.
 */
const modulesDoNotOverlap = async () => {
    const events = await eventsOf(e => ({
        './m.proof.f.mjs': { proof: { a: leaf(e, 'a') } },
        './n.proof.f.mjs': { proof: { b: leaf(e, 'b') } },
    }))
    assertEq(
        events,
        'start:a end:a report:.a start:b end:b report:.b summary',
        events)
}

/**
 * A leaf's returned tree is walked before the next sibling starts — the third
 * thing the fold orders, after the call and the report.
 *
 * The parent is reported before the child it produced runs, which is the
 * structural order every report already uses; a fanned-out traversal reports
 * the parent after its children have landed.
 */
const childrenRunBeforeTheNextSibling = async () => {
    const events = await eventsOf(e => ({
        './m.proof.f.mjs': {
            proof: {
                outer: () => {
                    e.push('start:outer')
                    return { inner: leaf(e, 'inner') }
                },
                after: leaf(e, 'after'),
            },
        },
    }))
    assertEq(
        events,
        'start:outer report:.outer start:inner end:inner report:.outer().inner'
        + ' start:after end:after report:.after summary',
        events)
}

export const proof = {
    siblingsDoNotOverlap,
    modulesDoNotOverlap,
    childrenRunBeforeTheNextSibling,
}
