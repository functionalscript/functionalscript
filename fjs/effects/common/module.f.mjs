/**
 * The operations no host owns, and the helpers that read their error channel.
 *
 * `all` / `allOk` / `both` (concurrency), `await` (promise resolution),
 * `fetch`, `import_`, `now` and `sandbox` each describe something a JavaScript
 * realm can do on its own, so every runner implements them the same way: the
 * Node runner in [`../node/module.mjs`](../node/module.mjs), the browser runner
 * in [`../browser/module.mjs`](../browser/module.mjs), and the virtual one in
 * [`../node/virtual/module.f.mjs`](../node/virtual/module.f.mjs).
 *
 * They lived in `../node/module.f.mjs`, which re-exports every name below so an
 * existing importer keeps naming one module. What is genuinely Node's — the
 * filesystem, streams, subprocesses, HTTP, an external test framework — stayed
 * there.
 *
 * See [`./types.ts`](./types.ts) for the type-level API.
 *
 * @module
 *
 * @import { Effect, Func, NotImplemented, Operation } from '../types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { All, Await, Fetch, Import, IoChannel, IoError, IoErrorInfo, Now, Sandbox } from './types.ts'
 */

import { do_, mapStep, pure, step } from '../module.f.mjs'
import { ok as resultOk, unwrap } from '../../types/result/module.f.mjs'

/**
 * Builds a normalized host error. The constructor exists so the shape is
 * written once: every runner reports its failures through it, and a consumer
 * matching on `'ioError'` knows what the payload holds.
 *
 * @type {(info: IoErrorInfo) => IoError}
 */
export const ioError = info => ['ioError', info]

/**
 * Normalizes a **thrown** value into an {@link IoError}: the OS error code when
 * the host attached a string one, and a message that is the `Error`'s own or
 * the value's string form.
 *
 * This is the boundary where an impure runner's `catch` becomes ordinary effect
 * data. Nothing past it sees the thrown object, which is the point — a stack, a
 * `cause`, and arbitrary own properties do not survive a wire hop, and a
 * program that branched on them would be reading the host's implementation
 * rather than the operation's contract.
 *
 * @type {(e: unknown) => IoError}
 */
export const toIoError = e => {
    const message = e instanceof Error ? e.message : String(e)
    if (typeof e !== 'object' || e === null || !('code' in e) || typeof e.code !== 'string') {
        return ioError({ message })
    }
    return ioError({ code: e.code, message })
}

/**
 * True if `e` is a "file or directory does not exist" (`ENOENT`) error.
 *
 * Node's filesystem rejections are `Error`s carrying `code: 'ENOENT'`, which
 * {@link toIoError} keeps; the virtual interpreter reports the same code for
 * absent paths. Lets callers swallow only the missing-path case (e.g. a fresh
 * store) while propagating genuine failures (permissions, corruption) rather
 * than masking them.
 *
 * A {@link NotImplemented} is never "not found": a runner that cannot perform
 * the operation has not looked for the path at all, so the two must not
 * collapse into one benign branch — which is exactly what a bare `unknown`
 * error channel used to allow.
 *
 * @type {(e: IoChannel) => boolean}
 */
export const isNotFound = ([tag, payload]) =>
    tag === 'ioError' && payload.code === 'ENOENT'

/**
 * Renders a channel error as a human line: an {@link IoError}'s own message, or
 * the command name a runner could not dispatch.
 *
 * @type {(e: IoChannel) => string}
 */
export const errorMessage = ([tag, payload]) =>
    tag === 'notImplemented' ? `operation not implemented: ${payload}` : payload.message

/**
 * Renders a channel error for a **remote** caller: the command name for a
 * {@link NotImplemented}, the OS error code for an `IoError`, and nothing else.
 *
 * {@link errorMessage} is for the operator of the program, who is entitled to
 * the host's own words — including the path that failed. A protocol client is
 * not, and the difference is not stylistic: `payload.message` is where the
 * host puts the absolute path it could not read, so answering an MCP tool call
 * with it publishes the server's filesystem layout to whoever is on the other
 * end. The code (`ENOENT`, `EACCES`) says *what* went wrong without saying
 * *where*, which is the part a client can act on anyway.
 *
 * A host that attached no code leaves nothing safe to forward, so the answer is
 * the bare kind. That is deliberate: guessing which part of a free-text message
 * is path-free is exactly the mistake this exists to prevent.
 *
 * @type {(e: IoChannel) => string}
 */
export const errorSummary = ([tag, payload]) =>
    tag === 'notImplemented'
        ? `operation not implemented: ${payload}`
        : payload.code === undefined ? 'io error' : `io error: ${payload.code}`

// all

/**
 * To run the operation `O` should be known by the runner/engine.
 * This is the reason why we merge `O` with `All` in the resulting effect.
 */
export const all =
    // `Func` cannot express a variadic generic operation, so the declared type
    // is written out here and `do_`'s is set aside.
    /** @type {<O extends Operation, T, E>(...a: readonly Effect<O, T, E>[]) => Effect<O | All, readonly Result<T, E>[], NotImplemented>} */
    (/** @type {unknown} */ (do_('all')))

/**
 * Collapses a list of results into a result of the list, keeping the **first**
 * error in list order and discarding the later ones.
 *
 * Keeping one is what makes this a `Result` rather than a report: the callers
 * that need it are chains, and a chain has one error channel. A site that wants
 * every failure wants a different return type and should not reach for this.
 *
 * @type {<T, E>(list: readonly Result<T, E>[]) => Result<readonly T[], E>}
 */
const okList = list => {
    for (const r of list) {
        if (r[0] === 'error') { return r }
    }
    return resultOk(list.map(unwrap))
}

/**
 * {@link all} in the `ok` channel: collects the values when every effect
 * succeeded, and answers with the first failure otherwise.
 *
 * `all` alone cannot serve a fallible chain. Its envelope is the runner's
 * (`OpResult`, saying whether the *operation* could be dispatched), so handing
 * it `Effect`s nests one `Result` inside another and the caller receives
 * `readonly Result<T, E>[]`. That has to be collapsed before the chain can
 * `step` again, and a continuation that forgets to is the value-discarding
 * hazard this migration exists to remove — one level in, where it is harder to
 * see.
 *
 * **Every effect still runs.** The short-circuit is in the *result*, not in the
 * execution: `all` performs them concurrently and this reads the answers once
 * they are all in, so a failure does not cancel its siblings the way it stops
 * the sequential `forEachStep` in `../module.f.mjs`. The error channel
 * unions the runner's
 * `NotImplemented` with the effects' own `E` for the same reason every other
 * step does — either can be what went wrong.
 *
 * @type {<O extends Operation, T, E>(...a: readonly Effect<O, T, E>[]) => Effect<O | All, readonly T[], NotImplemented | E>}
 */
export const allOk = (...a) =>
    step(all(...a), rs => pure(okList(rs)))

/**
 * @template {Operation} O0
 * @template T0
 * @template E0
 * @param {Effect<O0, T0, E0>} a
 * @returns {<O1 extends Operation, T1, E1>(b: Effect<O1, T1, E1>) => Effect<O0 | O1 | All, readonly[Result<T0, E0>, Result<T1, E1>], NotImplemented>}
 */
export const both = a => b =>
    /** @type {any} */ (all)(a, b)

// fetch

/** @type {Func<Fetch>} */
export const fetch = do_('fetch')

// import

/** @type {Func<Import>} */
export const import_ = do_('import')

// now

/** @type {Func<Now>} */
export const now = do_('now')

// sandbox

/**
 * Runs a plain synchronous function in an isolated, measured environment.
 *
 * Combines try/catch and high-resolution timing into a single atomic operation.
 * Only plain synchronous functions are accepted — no effects, no promises.
 *
 * Using a single operation rather than separate `TryCatch` + `Perf` effects is
 * necessary for correctness: effects execute as async tasks, so the scheduler
 * can insert arbitrary work between two separate timing calls, making the
 * measured delta inaccurate. Here the clock reads happen synchronously around
 * the function call with nothing in between.
 *
 * Future parameters (time limit, memory limit) can be added to the payload
 * without breaking the API. Worker-based implementations can enforce hard
 * limits via worker termination.
 *
 * @see {@link SandboxResult}
 *
 * @type {Func<Sandbox>}
 */
export const sandbox = do_('sandbox')

/** @type {Func<Await>} */
const awaitPromise = do_('await')

/** @type {(p: unknown) => Effect<Await, unknown, NotImplemented>} */
export const awaitIfPromise = p =>
    mapStep(awaitPromise(p), ([x]) => x)
