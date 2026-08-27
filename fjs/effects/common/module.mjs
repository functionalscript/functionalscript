/**
 * The impure half of the host-independent operations: the three handlers every
 * runner would otherwise write for itself.
 *
 * `../common/module.f.mjs` holds the *constructors* for `all`, `await`, `fetch`,
 * `import`, `now` and `sandbox`; this holds the parts of their *interpretation*
 * that are the same wherever they run. Nothing here touches a host: `sandbox`
 * needs a `try`/`catch`, a clock and `Promise`, `await` needs `Promise`, and
 * `io` needs a `catch` and the normalizer — all of which a bare JavaScript realm
 * has. What differs between hosts is `fetch`, `import`, the clock's epoch and
 * the concurrency policy, and those stay in each runner.
 *
 * It exists because the two runners had `sandbox`, `io` and the `await` body
 * byte-identical, with a comment in one saying it matched the other. That is the
 * drift this layer is meant to remove, and a comment is not a mechanism.
 *
 * @module
 *
 * @import { IoResult, SandboxResult } from './types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { toIoError } from './module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { asyncTryCatch } from '../../types/result/module.mjs'

/**
 * Performs host IO, reporting a thrown failure as an {@link IoResult} error.
 *
 * The one place where an exception becomes ordinary effect data, normalized so
 * that nothing past it sees the thrown object — a stack, a `cause` and
 * arbitrary own properties do not survive a wire hop.
 *
 * @template T
 * @param {() => Promise<T>} f
 * @returns {Promise<IoResult<T>>}
 */
export const io = async f => {
    const r = await asyncTryCatch(f)
    return r[0] === 'ok' ? r : error(toIoError(r[1]))
}

/**
 * Runs `f` and measures it: a genuine `Promise` is awaited and a rejection is
 * caught, and any other value — a proof tree carrying a `then` property
 * included — is the result as it stands.
 *
 * **This is the operation that actually executes a proof body**, so every runner
 * has to agree on it exactly or a test suite means different things in different
 * hosts. That is why it is here rather than written once per runner: the two
 * copies it replaces were identical, and nothing but a review would have caught
 * them drifting apart.
 *
 * The clock is read either side of the call with nothing in between, which is
 * the whole reason `sandbox` is one operation rather than a `tryCatch` and a
 * `now` a scheduler could interleave.
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
 * Resolves a real `Promise` and hands anything else back untouched, in the
 * one-element tuple the `await` operation answers with.
 *
 * @type {(p: unknown) => Promise<readonly[unknown]>}
 */
export const awaitPromise = async p =>
    [p instanceof Promise ? await p : p]
