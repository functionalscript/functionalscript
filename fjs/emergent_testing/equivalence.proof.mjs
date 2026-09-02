/**
 * **The two runners answer the same thing about the same fixtures.**
 *
 * The last property the sharing plan asks for, and the only one the individual
 * proofs cannot state: `browser/proof.mjs` asserts the page against `fmtImport`
 * and `testResult`, and `catch.proof.mjs` asserts the console traversal against
 * literals, so each is right about its own side. What neither can say is that
 * *one* suite produces *one* answer — which is the property a reader comparing
 * a CI log with a browser page depends on.
 *
 * So this file runs one fixture through both and compares the transcripts as
 * text. The comparison is deliberately narrow: name, status, and the run's
 * totals. `message` and `stack` are the page's own part and have no console
 * counterpart, and a duration is a measurement rather than an answer.
 *
 * `.mjs` rather than `.f.mjs`, for the reason `catch.proof.mjs` gives: the
 * console side needs a runner that can really `catch`, and the browser side is
 * a host module.
 *
 * @import { RunInstance } from '../effects/mock/types.ts'
 * @import { Write } from '../effects/node/types.ts'
 * @import { Catch, Sandbox } from '../effects/common/types.ts'
 * @import { Reporter } from './types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { assertEq } from '../asserts/module.f.mjs'
import { log } from '../effects/node/module.f.mjs'
import { run as mockRun } from '../effects/mock/module.f.mjs'
import { pureOk } from '../effects/module.f.mjs'
import { defaultTest, runModuleMap } from './module.f.mjs'
import { runBrowserProofs } from './browser/module.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { utf8ToString } from '../text/module.f.mjs'

/**
 * The module both runners are given.
 *
 * One of each thing the plan names: a plain leaf, a leaf whose *returned* tree
 * is walked (so the counts are recursive rather than one-per-export), a leaf
 * that throws, a name that needs quoting in a path, and a `throw` group where
 * throwing is the pass and returning is the failure.
 */
const fixture = {
    passes: () => undefined,
    nested: () => ({ child: () => undefined }),
    fails: () => { throw 'boom' },
    'a.b': () => undefined,
    throw: {
        threw: () => { throw 'expected' },
        didNot: () => undefined,
    },
}

/** The module's name, spelled the same for both runners so the names can be compared at all. */
const source = './m.proof.f.mjs'

/**
 * The fixture's transcript from the shared traversal, driven by a runner whose
 * `sandbox` and `catch` are a real `try`.
 *
 * @type {() => string}
 */
const consoleTranscript = () => {
    /** @type {RunInstance<Catch | Sandbox | Write, string>} */
    const runner = mockRun(/** @type {Parameters<typeof mockRun<Catch | Sandbox | Write, string>>[0]} */ ({
        sandbox: (/** @type {() => unknown} */ f) => (/** @type {string} */ s) => {
            try {
                return [s, ok({ result: ok(f()), duration: 0 })]
            } catch (e) {
                return [s, ok({ result: error(e), duration: 0 })]
            }
        },
        catch: (/** @type {() => unknown} */ f) => (/** @type {string} */ s) => {
            try {
                return [s, ok(ok(f()))]
            } catch (e) {
                return [s, ok(error(e))]
            }
        },
        write: (_stream, /** @type {Vec} */ data) => (/** @type {string} */ s) =>
            [s + utf8ToString(data), ok(undefined)],
    }))
    /** @type {Reporter<Catch | Sandbox | Write>} */
    const reporter = {
        // `start` writes nothing, so the transcript is answers only. A page
        // publishes no before-it-ran record, so there is nothing on the other
        // side to compare one against; that the console runner announces a
        // leaf first is `catch.proof.mjs`'s subject, not this file's.
        start: () => pureOk(undefined),
        result: t => log(`${t.name} ${t.status}`),
        summary: ({ totals: { passed, failed } }) => log(`${passed} passed, ${failed} failed`),
        test: defaultTest,
    }
    const [written] = runner('')(runModuleMap(reporter)({ [source]: { proof: fixture } }))
    return written
}

/**
 * The same transcript, built from what the page publishes.
 *
 * `report.results` is the page's own list rather than anything replayed, so
 * this reads the published record the way a consumer of the report would.
 *
 * @type {() => Promise<string>}
 */
const browserTranscript = async () => {
    const report = await runBrowserProofs([[source, fixture]])
    const lines = report.results.map(r => `${r.name} ${r.status}\n`)
    const { passed, failed } = report.totals
    return `${lines.join('')}${passed} passed, ${failed} failed\n`
}

export const proof = {
    /**
     * **One suite, one answer.**
     *
     * The whole transcript is compared rather than a field at a time, so a
     * disagreement about *which* leaves ran — a walk that stops early, a
     * returned tree one runner recurses into and the other does not — fails
     * here too, and not only a disagreement about a status.
     *
     * Mutation-checked: give the page's `collectTests` a root `throws` of
     * `true` — a divergence in one runner only, which every proof asserting a
     * runner against a shared function still passes — and this fails.
     */
    transcriptsAgree: async () => {
        assertEq(await browserTranscript(), consoleTranscript())
    },
    /**
     * The comparison above is only worth something if the fixture actually
     * exercises what it claims, so this pins the transcript itself: five leaves
     * from four exports, a nested one named through its parent's call, a
     * quoted path segment, and a `throw` group in which throwing passes and
     * returning fails.
     *
     * Without it, two runners that both walked nothing would agree.
     */
    theFixtureIsWorthComparing: async () => {
        assertEq(await browserTranscript(),
            `import("./m.proof.f.mjs").proof.passes() passed
import("./m.proof.f.mjs").proof.nested() passed
import("./m.proof.f.mjs").proof.nested().child() passed
import("./m.proof.f.mjs").proof.fails() failed
import("./m.proof.f.mjs").proof["a.b"]() passed
import("./m.proof.f.mjs").proof.throw.threw() passed
import("./m.proof.f.mjs").proof.throw.didNot() failed
5 passed, 2 failed
`)
    },
}
