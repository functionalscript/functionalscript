/**
 * @import { RunInstance } from '../mock/types.ts'
 * @import { Catch, Sandbox } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { run as mockRun } from '../mock/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { catch_, sandbox } from './module.f.mjs'

/**
 * A runner claiming both operations by the names they are declared under.
 *
 * **The names are the interface.** A host does not import these constructors —
 * it receives whatever command they built and looks it up in a map it wrote
 * itself, so `'sandbox'` and `'catch'` are the only thing the two sides agree
 * on. A renamed command is not a type error anywhere; it is an unclaimed
 * command at runtime, in whichever host is unlucky. Interpreting them through a
 * handler map keyed by those strings is what states the agreement.
 *
 * Neither handler actually catches: this file is `.f.mjs` and FunctionalScript
 * has no `try`/`catch`, which is the same bargain `../node/virtual` makes and
 * the reason {@link Catch} exists as an operation rather than as a function.
 * Proving what a *real* handler does with a thrower belongs to the hosts that
 * can write one — `../node/proof.f.mjs` for the node runner,
 * `../../emergent_testing/catch.proof.mjs` for a caught throw.
 *
 * @type {RunInstance<Catch | Sandbox, null>}
 */
const runner = mockRun(/** @type {Parameters<typeof mockRun<Catch | Sandbox, null>>[0]} */ ({
    sandbox: (/** @type {() => unknown} */ f) => (/** @type {null} */ s) => [s, ok(f())],
    catch: (/** @type {() => unknown} */ f) => (/** @type {null} */ s) => [s, ok(ok(f()))],
}))

export const proof = {
    sandbox: () => {
        const [, r] = runner(null)(sandbox(() => ({ result: ok(42), duration: 7 })))
        assert(r[0] === 'ok', r)
        // Two `Result`s, one inside the other: the operation's own status, and
        // the sandboxed function's outcome carried as data.
        const { result, duration } = r[1]
        assertEq(result[1], 42)
        assertEq(duration, 7)
    },
    catch: () => {
        const [, r] = runner(null)(catch_(() => 'value'))
        assert(r[0] === 'ok', r)
        assertEq(r[1][1], 'value')
    },
}
