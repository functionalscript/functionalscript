/**
 * Operations more than one host implements.
 *
 * `fjs/effects/node` declared these because Node was the only host that ran
 * them. It is not the criterion — an operation belongs to the layer of whoever
 * *implements* it, and a browser interpreter implements these two. Declaring
 * them here is what lets a host talk to the shared FunctionalScript logic
 * without importing a module named after a different host.
 *
 * `effects/node` re-exports both, so a node-side caller keeps one import and
 * signatures keep reading as one vocabulary. That re-export is not a shim: it
 * would be one if it kept a *dead* coupling alive, and `NodeOp` is genuinely
 * declared over `Sandbox` and `Catch`.
 *
 * @module
 */

import type { Result } from '../../types/result/types.ts'
import type { OpResult } from '../types.ts'

/**
 * The outcome of a `Sandbox` operation.
 *
 * `result` carries either `['ok', value]` or `['error', thrown]`. `duration`
 * is a floating-point millisecond count with up to microsecond precision,
 * matching `performance.now()` directly. Additional fields (allocated memory,
 * max stack depth, coverage) may be added in future without breaking consumers.
 */
export type SandboxResult<T> = {
    readonly result: Result<T, unknown>
    /**
     * Elapsed time in milliseconds (microsecond precision via `performance.now()`).
     * The virtual runner returns `0` for deterministic tests.
     */
    readonly duration: number
}

/**
 * Runs a plain function in an isolated, measured environment.
 *
 * `Awaited<T>` because a handler that can await one does: a thunk answering
 * `Promise<V>` is measured to where it settled and puts `V` in the result. `T`
 * would promise a caller a promise that is not there.
 *
 * **The scope is ordinary code, and that is a decision rather than an
 * oversight.** A handler awaits an `instanceof Promise` and nothing else, so a
 * bare thenable — `{ then(r) { r(42) } }` — is stored as the object it is while
 * `Awaited<T>` types it as the value it would have resolved to, and a promise
 * from another realm is stored for the same reason. Both discrepancies are
 * known and neither is worth a conditional type here.
 *
 * The narrow rule is deliberate where it matters: a proof's returned value with
 * a `then` key is *a sub-tree with a test called `then` in it*, and awaiting it
 * would adopt the tree instead of walking it. What a runner should do about
 * cross-realm promises is the subject of
 * `emergent_testing/todo/imports-promises-realms.md`, which is where such a
 * decision belongs — not in a type describing the common case.
 *
 * This operation measures and traps *ordinary* JavaScript. It is not a boundary
 * against adversarial JavaScript, and pursuing every shape a `then` can take is
 * a rabbit hole with no end and no reader.
 */
export type Sandbox = readonly['sandbox', <T>(f: () => T) => OpResult<SandboxResult<Awaited<T>>>]

/**
 * Runs a pure thunk and answers what it did: its value, or the value it threw.
 *
 * It sits beside {@link Sandbox} and is deliberately *not* it. `sandbox` carries
 * a clock and, in the virtual runner, a fixture convention — its handler is a
 * pass-through whose thunk is expected to answer a {@link SandboxResult}
 * directly, because `../node/virtual` is `.f.mjs` and FunctionalScript has no
 * `try`/`catch` to implement a real one with. Routing a tree walk through
 * `sandbox` would hand that handler a thunk answering something else entirely.
 *
 * This one carries neither, so every runner implements it truthfully: the real
 * Node runner and a browser interpreter with `tryCatch`, and the virtual runner
 * with `ok(ok(f()))` — a pure runner still cannot catch, so a hostile fixture
 * still panics there, which is the same bargain `sandbox` already makes.
 *
 * It exists because reading a *user* value is an operation, not pure logic: the
 * proof traversal enumerates values a test returned, and an enumerable getter or
 * a proxy trap in one of them is a failure of that test rather than of the run.
 */
export type Catch = readonly['catch', <T>(f: () => T) => OpResult<Result<T, unknown>>]
