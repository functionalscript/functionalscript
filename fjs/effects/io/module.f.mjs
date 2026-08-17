/**
 * The Effect composition API: the branch-aware {@link step},
 * {@link catchStep}, and {@link resultStep}, the two lifts that enter the
 * layer, and {@link mapStep}.
 *
 * An `Effect<O, T, E>` is `RawEffect<O, Result<T, E>>` (`./types.ts`) — the raw
 * effect from [`../module.f.mjs`](../module.f.mjs) with its failure in the
 * type. These operations are what makes that alias worth naming: raw `step`
 * knows nothing of `Result`, so it runs its continuation whether or not the
 * previous effect failed, and a fallible chain written with it continues past
 * an error unless every caller forwards each `Result` by hand.
 *
 * They live in their own module because {@link step} and {@link mapStep}
 * collide with the raw ones, which stay available for consumers still written
 * against the raw contracts. Nothing here has a consumer yet: stage 3 moves the
 * `Result` envelope into the operations' declared return types, and stage 4
 * migrates the consumers ([`./README.md`](./README.md)).
 *
 * The three branch-aware operations are the whole vocabulary:
 *
 * - {@link step} — continue on `ok`, propagate the `error`. The normal path.
 * - {@link catchStep} — continue on `error`, preserve the `ok`. The error path.
 * - {@link resultStep} — continue with the complete `Result`. Both paths.
 *
 * **The error channel is unioned, not unified**, following `okThen`
 * (`fjs/types/result/module.f.mjs`), the pure sibling of this bind: neither
 * side is pre-widened, and a branch that is passed through stays the very tuple
 * it arrived as rather than being rebuilt to retag it into a wider type.
 * {@link step} unions the error channel and replaces the success type;
 * {@link catchStep} mirrors it, unioning the success channel and replacing the
 * error type.
 *
 * Recovery therefore never needs `try`/`catch` — which FunctionalScript does
 * not offer, and whose `throw` stays reserved for panics. Escalating an error
 * to a panic is a decision the program makes explicitly, by `unwrap`ping what
 * {@link resultStep} hands it.
 *
 * The raw module's composition rules apply here unchanged: bind each link in a
 * sequence to its own name at one level, do not nest steps, and break a call
 * that does not fit one line after `(` with one argument per line.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { RawEffect, History, Operation } from '../types.ts'
 * @import { Effect } from './types.ts'
 */

import { fold } from '../../types/list/module.f.mjs'
import { error, mapOk, ok, unwrap } from '../../types/result/module.f.mjs'
import { mapStep as rawMapStep, pure, step as rawStep } from '../module.f.mjs'

/**
 * Lifts a value into a successful `Effect` — `pure(ok(v))` written once.
 *
 * One of the two entry points into the layer: {@link step} and its siblings
 * compose `Effect`s but cannot produce the first one, and until stage 3 gives
 * the operations their `Result` envelope, nothing else does either.
 *
 * The error channel is `never`, which is not a special case to handle but the
 * ordinary consequence of the union rules: `never | E` is `E`, so a lifted
 * value composes with any chain without widening its errors.
 *
 * @type {<T>(v: T) => Effect<never, T, never>}
 */
export const pureOk = v => pure(ok(v))

/**
 * Lifts an error into a failed `Effect` — `pure(error(e))` written once, and
 * the mirror of {@link pureOk}, with the success channel `never` instead.
 *
 * This is how a program *originates* a failure: a fallback that has run out of
 * options, or a guard that rejects its input before performing anything. A
 * runner producing `error(notImplemented)` is stage 6 and does not go through
 * here — that error arrives through an operation's own continuation.
 *
 * @type {<E>(e: E) => Effect<never, never, E>}
 */
export const pureError = e => pure(error(e))

/**
 * The normal path: run `e`, and continue with `f` **only** if it succeeded. An
 * `error` short-circuits the rest of the chain and is passed through unchanged.
 *
 * This is the default error propagation the migration exists to provide — the
 * structured replacement for exception-style propagation, analogous to Rust's
 * `?`. A sequence therefore reads as its success path, and mentions errors only
 * where it intentionally handles them:
 *
 * ```js
 * const a = writeFile(...)
 * const b = step(a, () => console('written'))
 * ```
 *
 * `'written'` is printed only when `writeFile` returned `ok`. The same line
 * written with raw `step` prints it either way, which is the hazard this
 * replaces — and note that it is the *value-discarding* continuation that hides
 * it, since one that reads the value would not have compiled.
 *
 * **The error types are unioned** (`E | F`), so `f` may fail in its own way
 * without either side being pre-widened; the operation sets union too, since
 * `f` performs effects of its own.
 *
 * The body is raw `step` over the one branch this layer is named for: an
 * `error` is handed back as the very tuple it arrived as rather than rebuilt to
 * retag it into a wider type, which is what makes `E | F` expressible instead
 * of forcing both sides to one error type. The continuation is annotated for
 * that reason — its two branches have different types, and the annotation
 * states the union they belong to rather than leaving the compiler to infer it
 * from whichever it reads first.
 *
 * This used to route through an exported `okStep` in the raw module. Nothing
 * else ever called it: the adapter *was* this function's body, one indirection
 * away, so it is written here now and the raw layer has one export fewer.
 *
 * @template {Operation} O
 * @template T
 * @template E
 * @template {Operation} Q
 * @template R
 * @template F
 * @param {Effect<O, T, E>} e
 * @param {(t: T) => Effect<Q, R, F>} f
 * @returns {Effect<O | Q, R, E | F>}
 */
export const step = (e, f) => {
    /** @type {(r: Result<T, E>) => Effect<Q, R, E | F>} */
    const cont = r => r[0] === 'error' ? pure(r) : f(r[1])
    return rawStep(e, cont)
}

/**
 * The error path: run `e`, and continue with `f` **only** if it failed. An `ok`
 * is preserved unchanged, so the recovery is the only branch that mentions the
 * failure.
 *
 * The exact mirror of {@link step}: where that unions the error channel and
 * replaces the success type, this unions the success channel (`T | R` — the
 * preserved value or the recovery's) and replaces the error type with `f`'s.
 * Recovering from every error therefore leaves `F` uninhabited, and the type
 * says so.
 *
 * Use it for *intentional* recovery — a fallback operation after a
 * `NotImplemented`, a default for a missing file — never as a blanket
 * "continue anyway"; that is what {@link step}'s propagation already prevents.
 *
 * The local continuation is annotated for the same reason {@link step}'s is:
 * its two branches have different types — `f`'s effect and the untouched `ok`
 * tuple — and the annotation states the union they belong to instead of
 * leaving the compiler to infer it from whichever branch it reads first.
 *
 * @template {Operation} O
 * @template T
 * @template E
 * @template {Operation} Q
 * @template R
 * @template F
 * @param {Effect<O, T, E>} e
 * @param {(err: E) => Effect<Q, R, F>} f
 * @returns {Effect<O | Q, T | R, F>}
 */
export const catchStep = (e, f) => {
    /** @type {(r: Result<T, E>) => Effect<Q, T | R, F>} */
    const cont = r => r[0] === 'error' ? f(r[1]) : pure(r)
    return rawStep(e, cont)
}

/**
 * Both paths: run `e` and hand `f` the complete `Result`, which then decides
 * what the outcome is. Use it where both branches genuinely matter — a report
 * that records the failure, a retry policy, or the point where a program
 * escalates an error to a panic by `unwrap`ping it.
 *
 * Expanded through the alias this **is** the raw `step` at the Io
 * instantiation: a continuation that takes a `Result<T, E>` and returns an
 * effect is what raw `step` already offers, so this adds no branch behavior of
 * its own and is that function with a narrower type.
 *
 * It still earns the name. The three operations are the canonical vocabulary of
 * the layer, and a chain that spells one of them as a raw `step` reads as an
 * escape from the layer rather than as the deliberate both-branches case. This
 * is the spelling that says the both-branches case was meant.
 *
 * `finallyStep` is declined on the same principle read the other way: a
 * derivable form earns a name by being canonical vocabulary, and that one has
 * not shown it is. It is `resultStep` plus a policy, and adds no expressive
 * power until real consumers demonstrate a repeated policy worth naming.
 *
 * @type {<O extends Operation, T, E, Q extends Operation, R, F>(
 *     e: Effect<O, T, E>,
 *     f: (r: Result<T, E>) => Effect<Q, R, F>
 * ) => Effect<O | Q, R, F>}
 */
export const resultStep = rawStep

/**
 * Applies a pure function to the `ok` value, passing an `error` through
 * unchanged: the functor `map` of this layer, and a {@link step} whose
 * continuation performs nothing further.
 *
 * It exists for the same reason the raw `mapStep` does — a trailing pure
 * projection is where a sequence *ends*, not another link in it, and spelling
 * it as a step misreports how many effects a chain runs
 * (`../todo/map-step-combinator.md`). Without it, every site converted in stage
 * 4 would regress to exactly that spelling, now with a `pureOk` inside it.
 *
 * **The operation set does not widen**, as with the raw `mapStep`: a pure
 * projection issues no commands. Neither does the error channel — `f` cannot
 * fail, so a chain that only projects its value keeps the errors it already
 * had.
 *
 * @type {<O extends Operation, T, E, R>(e: Effect<O, T, E>, f: (t: T) => R) => Effect<O, R, E>}
 */
export const mapStep = (e, f) => rawMapStep(e, mapOk(f))

/**
 * Leaves the layer by **panicking** on the error branch: `ok` values continue
 * as an ordinary raw `RawEffect`, an `error` is thrown.
 *
 * This is the program exercising its right to treat a failure as fatal, and it
 * is a policy — not a conversion. It belongs at a site that genuinely has no
 * answer to the failure: a build tool that cannot read its own sources, a
 * proof whose fixture is missing. Where a caller could do something else,
 * {@link catchStep} or {@link resultStep} is the honest spelling, and a chain
 * that merely passes the failure along wants {@link step}.
 *
 * It is deliberately one greppable name rather than an `unwrap` buried in each
 * continuation. Every occurrence is a site that has chosen to panic, so the
 * choice can be reviewed, and the set of sites that have not yet chosen
 * anything better is exactly the set this name marks.
 *
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>) => RawEffect<O, T>}
 */
export const unwrapStep = e => rawMapStep(e, unwrap)

/**
 * Starts a history from a fallible effect, lifting its `ok` value into a
 * one-element tuple that {@link historyStep} extends. The Io twin of the raw
 * `history`, and the entry point a chain needs exactly once.
 *
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>) => Effect<O, readonly[T], E>}
 */
export const history = e => mapStep(e, v => [v])

/**
 * Like {@link step}, but carries the values forward instead of discarding
 * them: runs `e` for the history `p`, continues with `f(...p)` for `r`, and
 * yields `[r, ...p]`.
 *
 * This is what keeps a **fallible** chain flat. Each `step`'s continuation sees
 * only the value it consumes, so a later link cannot reach an earlier one, and
 * the alternative — nesting so the inner continuation closes over the outer
 * one's parameter — is what `fjs/AGENTS.md` §3.4 rules out. The raw
 * `historyStep` cannot serve here: it would carry each link's `Result` into the
 * tuple rather than its value, so every later link would destructure results it
 * has no intention of handling.
 *
 * The history holds `ok` values only. An `error` short-circuits the chain, so a
 * failed link contributes nothing to the tuple — which is the point: a later
 * link reads earlier values without asking whether they are there.
 *
 * @template {Operation} O
 * @template {readonly unknown[]} P
 * @template E
 * @template {Operation} Q
 * @template R
 * @template F
 * @param {Effect<O, P, E>} e
 * @param {(...p: Readonly<P>) => Effect<Q, R, F>} f
 * @returns {Effect<O | Q, readonly[R, ...P], E | F>}
 */
export const historyStep = (e, f) => {
    /** @type {(param: P) => Effect<Q, readonly[R, ...P], F>} */
    const cont = param => mapStep(f(...param), result => [result, ...param])
    return step(e, cont)
}

/**
 * Threads a state through one fallible effect per item, short-circuiting on the
 * first `error`: the Io twin of the raw `foldStep`.
 *
 * **`items` is a raw effect.** Both of the shapes that need this fold — a list
 * the caller already holds (`pure(jobs)`) and one an infallible operation
 * produced — reach it without an error channel of their own, so requiring one
 * would mean lifting at every call site to express something no consumer has.
 * A fallible producer composes with {@link step} ahead of the fold instead.
 *
 * @template {Operation} O
 * @template T
 * @template {Operation} Q
 * @template S
 * @template E
 * @param {RawEffect<O, List<T>>} items
 * @param {S} init
 * @param {(item: T) => (state: S) => Effect<Q, S, E>} f
 * @returns {Effect<O | Q, S, E>}
 */
export const foldStep = (items, init, f) => {
    /** @type {Fold<T, Effect<Q, S, E>>} */
    const op = item => acc => step(acc, f(item))
    return rawStep(items, fold(op)(pureOk(init)))
}

/**
 * Runs `f(item)` for each item in order, stopping at the first failure and
 * propagating it. The `void` accumulator sibling of {@link foldStep}.
 *
 * Stopping is the difference that matters against the raw `forEachStep`: that
 * one runs every item whatever each one answered, because its `void`
 * accumulator has nothing to carry a failure in — and TypeScript's `void`
 * return position accepts a `Result`-valued effect silently, so the discard
 * does not even show up as a type error.
 *
 * @type {<O extends Operation, T, Q extends Operation, E>(
 *     items: RawEffect<O, List<T>>,
 *     f: (item: T) => Effect<Q, void, E>
 * ) => Effect<O | Q, void, E>}
 */
export const forEachStep = (items, f) =>
    foldStep(items, undefined, item => () => f(item))
