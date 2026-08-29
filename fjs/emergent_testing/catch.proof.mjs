/**
 * The shared traversal, driven by a runner that can actually catch.
 *
 * This proof is `.mjs` rather than `.f.mjs` deliberately, and the reason is the
 * same one that made the `catch` operation necessary in the first place: a
 * runner which reports a throw instead of propagating it needs `try`/`catch` to
 * write, and FunctionalScript has neither. `../effects/node/virtual` answers
 * `ok(ok(f()))` for exactly that reason, so it cannot demonstrate the behaviour
 * — only a host runner can, and a host runner belongs in a host file.
 *
 * @import { RunInstance } from '../effects/mock/types.ts'
 * @import { Write } from '../effects/node/types.ts'
 * @import { Catch, Sandbox } from '../effects/common/types.ts'
 * @import { Reporter } from './types.ts'
 * @import { Vec } from '../types/bit_vec/types.ts'
 */

import { assert } from '../asserts/module.f.mjs'
import { log } from '../effects/node/module.f.mjs'
import { run as mockRun } from '../effects/mock/module.f.mjs'
import { defaultTest, runModuleMap } from './module.f.mjs'
import { error, ok } from '../types/result/module.f.mjs'
import { utf8ToString } from '../text/module.f.mjs'

/**
 * Runs `proof` through the shared traversal on a runner whose `sandbox` and
 * `catch` are real, and answers everything the reporter wrote.
 *
 * The written lines are the runner's *state* rather than a captured array, so
 * the proof reads the same way a virtual run does and nothing here mutates a
 * value it closed over.
 *
 * @type {(proof: unknown) => string}
 */
const runWith = proof => {
    /** @type {Reporter<Sandbox | Write>} */
    const reporter = {
        start: ({ path }) => log(`start:${path}`),
        result: (t, _r, _throws) => log(`${t.path}:${t.status}`),
        summary: ({ totals: { passed, failed } }) => log(`summary:${passed}:${failed}`),
        test: defaultTest,
    }
    // No `all` handler, and that is not an omission: the shared traversal is
    // sequential, so it issues none — a restored fan-out would panic here as an
    // unclaimed command. What the *order* of a run must be is proved
    // separately, in `./sequential.proof.mjs`, on a runner that can interleave.
    /** @type {RunInstance<Catch | Sandbox | Write, string>} */
    const runner = mockRun(/** @type {Parameters<typeof mockRun<Catch | Sandbox | Write, string>>[0]} */ ({
        // The two handlers this proof turns on. A real `try` is what
        // `../effects/node/virtual` cannot offer and what the Node runner does.
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
    const [written] = runner('')(runModuleMap(reporter)({ './h.proof.f.mjs': { proof } }))
    return written
}

/**
 * A leaf whose returned tree cannot be enumerated is that leaf's failure, not
 * the run's.
 *
 * Before the `catch` operation the throw escaped the traversal and took the
 * whole run with it — including the modules that had already passed and would
 * now never be reported. That is what the second assertion is for: `good` is
 * not incidental company, it is the part that used to be lost.
 */
const returnedTreeThrows = () => {
    const written = runWith({
        good: () => 1,
        // Enumerating the returned value runs this getter.
        bad: () => ({ get boom() { throw new Error('trap') } }),
    })
    assert(written.includes('.bad:failed'), written)
    assert(written.includes('.good:passed'), written)
    assert(written.includes('summary:1:1'), written)
}

/**
 * A readable returned tree is still walked, so the guard did not replace the
 * recursion with a refusal to recurse.
 */
const returnedTreeIsStillWalked = () => {
    const written = runWith({ outer: () => ({ inner: () => 1 }) })
    assert(written.includes('.outer:passed'), written)
    assert(written.includes('.outer().inner:passed'), written)
    assert(written.includes('summary:2:0'), written)
}

export const proof = {
    returnedTreeThrows,
    returnedTreeIsStillWalked,
}
