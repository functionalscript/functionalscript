/**
 * The Effect composition API: the branch-aware {@link step},
 * {@link catchStep}, and {@link resultStep}, the two lifts that enter the
 * layer, and the two projections {@link mapStep} and {@link resultMapStep}.
 *
 * The `Effect<O, T, E>` these compose is defined in
 * [`../types.ts`](../types.ts), alongside the representation and the
 * interpreters that read it. This module is the **composition**, that one is
 * the **representation**, and neither exports what the other does.
 *
 * They were separate for a different reason once: the representation module
 * carried a `Result`-blind `step` and `mapStep` that these collided with by
 * name. Those are gone — a `step` that ran its continuation whether or not the
 * previous effect failed described no case worth having, since every effect
 * carries a `Result` — and {@link resultStep} is that former general function
 * at the type that says what its continuation receives.
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
 * The composition rules: bind each link in a sequence to its own name at one
 * level, do not nest steps, and break a call that does not fit one line after
 * `(` with one argument per line.
 *
 * @module
 *
 * @import { List } from '../../types/list/types.ts'
 * @import { Fold } from '../../types/function/operator/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Effect, ErrOf, NotImplemented, OkOf, Operation } from '../types.ts'
 */

import { fold } from '../../types/list/module.f.mjs'
import { error, mapOk, ok } from '../../types/result/module.f.mjs'
import { pure } from '../module.f.mjs'

/**
 * Lifts a value into a successful `Effect` — `pure(ok(v))` written once.
 *
 * One of the two entry points into the layer: {@link step} and its siblings
 * compose `Effect`s but cannot produce the first one, and the only other source
 * is an operation's own `Result`.
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
 * A runner producing `error(notImplemented)` does not go through here — that
 * error arrives through an operation's own continuation.
 *
 * @type {<E>(e: E) => Effect<never, never, E>}
 */
export const pureError = e => pure(error(e))

/**
 * Builds the {@link NotImplemented} a runner answers with when it cannot
 * dispatch `command`.
 *
 * It names the command and nothing else. A `Do` node's payload may hold
 * functions — `createServer`'s listener, `sandbox`'s thunk, `test`'s body — so
 * carrying it would break the serializability this error type promises, and the
 * command name is the part a program can act on anyway.
 *
 * @type {(command: string) => NotImplemented}
 */
export const notImplemented = command => ['notImplemented', command]

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
 * `'written'` is printed only when `writeFile` returned `ok`. Written with the
 * `Result`-blind `step` this replaced, the same line printed it either way —
 * and note that it was the *value-discarding* continuation that hid the
 * hazard, since one that read the value would not have compiled.
 *
 * **The error types are unioned** (`E | F`), so `f` may fail in its own way
 * without either side being pre-widened; the operation sets union too, since
 * `f` performs effects of its own.
 *
 * The body is {@link resultStep} over the one branch this layer is named for:
 * an `error` is handed back as the very tuple it arrived as rather than rebuilt
 * to retag it into a wider type, which is what makes `E | F` expressible instead
 * of forcing both sides to one error type. The continuation is annotated for
 * that reason — its two branches have different types, and the annotation
 * states the union they belong to rather than leaving the compiler to infer it
 * from whichever it reads first.
 *
 * This used to route through an `okStep` exported by the representation
 * module. Nothing
 * else ever called it: the adapter *was* this function's body, one indirection
 * away, so it is written here now and that module has one export fewer.
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
    return resultStep(e, cont)
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
    return resultStep(e, cont)
}

/**
 * Both paths: run `e` and hand `f` the complete `Result`, which then decides
 * what the outcome is. Use it where both branches genuinely matter — a report
 * that records the failure, a retry policy, or the point where a program
 * escalates an error to a panic by `unwrap`ping it.
 *
 * **This is the layer's primitive**, and {@link step} and {@link catchStep} are
 * written in terms of it — each is this function with a continuation that
 * inspects the tag first. It used to be the other way round: a `step` in the
 * representation module composed effects with opaque payloads, and this was
 * that function re-exported under a narrower type. Since every effect carries a
 * `Result`, the opaque spelling described nothing the `Result`-shaped one does
 * not, so the general function lives here now, at the type that says what its
 * continuation receives.
 *
 * `finallyStep` is declined on the principle that a derivable form earns a name
 * by being canonical vocabulary, and that one has not shown it is. It is
 * `resultStep` plus a policy, and adds no expressive power until real consumers
 * demonstrate a repeated policy worth naming.
 *
 * **It is not lazy.** It reads `e`'s shape immediately, so a `Pure` head is
 * forced and `f` is called right there: `resultStep(pure(r), f)` *is* `f(r)`,
 * evaluated where the composition is written rather than where the effect is
 * run. Only the `Do` case defers — the continuation rebuilt around `f` runs
 * when a runner reaches that node.
 *
 * That is sound rather than an oversight, and it is sound only because of
 * `Pure`'s contract: a `Pure` holds a result that has already been computed, so
 * forcing it early observes nothing, repeats nothing, and can throw nothing.
 * Composing never performs a `Do` node, which is where anything real lives.
 * Break the contract — hide work behind the thunk — and merely composing a
 * chain starts running the program.
 *
 * A composition cannot be suspended, and no combinator can fix that:
 * `defer: (() => Effect<O, T, E>) => Effect<O, T, E>` cannot be written, because
 * the `Pure` / `Do` tag must be known before anything runs and the union has no
 * third case meaning "not yet decided". That is inherent to the representation,
 * not a gap in this module's API. A caller that needs to name a composition
 * without performing it yet has to keep the ingredients and defer the step
 * itself.
 *
 * @type {<O extends Operation, T, E, Q extends Operation, R, F>(
 *     e: Effect<O, T, E>,
 *     f: (r: Result<T, E>) => Effect<Q, R, F>
 * ) => Effect<O | Q, R, F>}
 */
export const resultStep = (e, f) =>
    typeof e === 'function'
        ? f(e())
        : { ...e, continuation: x => resultStep(e.continuation(x), f) }

/**
 * Applies a pure function to the `ok` value, passing an `error` through
 * unchanged: the functor `map` of this layer, and a {@link step} whose
 * continuation performs nothing further.
 *
 * A trailing pure projection is where a sequence *ends*, not another link in
 * it, and spelling it as a step misreports how many effects a chain runs
 * (`../todo/map-step-combinator.md`). Without this, every such site would
 * regress to exactly that spelling, now with a `pureOk` inside it.
 *
 * **The operation set does not widen**: a pure projection issues no commands. Neither does the error channel — `f` cannot
 * fail, so a chain that only projects its value keeps the errors it already
 * had.
 *
 * @type {<O extends Operation, T, E, R>(e: Effect<O, T, E>, f: (t: T) => R) => Effect<O, R, E>}
 */
export const mapStep = (e, f) => resultMapStep(e, mapOk(f))

/**
 * Applies a pure function to the whole {@link Result}: the both-branches
 * sibling of {@link mapStep}, and the {@link resultStep} whose continuation
 * performs nothing further.
 *
 * Reach for it where a projection genuinely decides the outcome rather than
 * transforming a value — turning any answer into a fixed one, replacing a
 * channel wholesale, re-tagging a failure. Where only the success is being
 * transformed, {@link mapStep} says so and leaves the channel alone.
 *
 * **Neither channel is preserved**, which is the difference that matters
 * against `mapStep`: `f` returns a `Result<R, F>` of its own, so a caller can
 * discard errors here. That is exactly what makes it the honest spelling for a
 * site that means to — the discarding is written down, in a function that says
 * it takes both branches, instead of being implied by a value-shaped `map` that
 * quietly received a `Result`.
 *
 * Its two output channels are read off `f`'s return type with {@link OkOf} /
 * {@link ErrOf}, for the reason `pure` gives: inference against the `Result`
 * union cannot place a one-sided return, so a projection that always answers
 * `ok` would otherwise acquire an error channel it never produces.
 *
 * @type {<O extends Operation, T, E, R extends Result<unknown, unknown>>(
 *     e: Effect<O, T, E>,
 *     f: (r: Result<T, E>) => R
 * ) => Effect<O, OkOf<R>, ErrOf<R>>}
 */
export const resultMapStep = (e, f) => resultStep(e, r => pure(f(r)))

/**
 * Empties the error channel by **panicking** on it: `ok` values continue
 * unchanged, an `error` is thrown as `summary(e)`, and what comes back is an
 * `Effect<O, T, never>` — a `never` that is earned rather than asserted, since
 * the only way past this point is success.
 *
 * This is the program exercising its right to treat a failure as fatal, and it
 * is a policy — not a conversion. It belongs at a site that genuinely has no
 * answer to the failure: a build tool that cannot read its own sources, a
 * proof whose fixture is missing. Where a caller could do something else,
 * {@link catchStep} or {@link resultStep} is the honest spelling, and a chain
 * that merely passes the failure along wants {@link step}.
 *
 * **`summary` is what names the errors being panicked on, and it is required
 * for that reason rather than for the message.** Without it this function was
 * generic in `E` and therefore compiled however far a channel widened: one
 * fallible read added upstream enlarged what every downstream call crashed on,
 * silently. A renderer written for a particular channel cannot accept a wider
 * one — parameters are contravariant — so widening becomes a compile error at
 * the site that chose to panic, which is the site that has to choose again.
 *
 * The `IoChannel` renderer is `errorSummary` (`../node/module.f.mjs`); pass a
 * narrower one where the channel is narrower. An inline `e => String(e)`
 * accepts anything and gives the old behaviour back — that is an escape hatch,
 * and being written out at the call site is the point.
 *
 * This being one greppable name still matters: every occurrence is a site that
 * has chosen to panic, so the choice can be reviewed. What the name alone
 * could not do is tell a reviewer that a site's *scope* had grown since they
 * last looked at it, which is what the argument adds.
 *
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>, summary: (e: E) => string) => Effect<O, T, never>}
 */
export const unwrapStep = (e, summary) => resultMapStep(e, r => {
    if (r[0] === 'error') { throw summary(r[1]) }
    return r
})

/**
 * Starts a history from a fallible effect, lifting its `ok` value into a
 * one-element tuple that {@link historyStep} extends — the entry point a chain
 * needs exactly once.
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
 * one's parameter — is what `fjs/AGENTS.md` §3.4 rules out. A `Result`-blind
 * `historyStep` could not serve: it carried each link's `Result` into the tuple
 * rather than its value, so every later link had to destructure results it had
 * no intention of handling. That is why this one exists and that one does not.
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
 * Threads a state through one effect per item, short-circuiting on the first
 * `error`.
 *
 * **`items` is an `Effect` like everything else here.** Its payload was once
 * unwrapped, on the argument that a held list has no error channel and
 * requiring one would mean lifting at every call site. Lifting is one `pureOk`
 * call, and that version made the *fallible* producer pay instead:
 * `fjs/cas/cli` wrapped the whole fold in a `step` whose only job was to unwrap
 * `list()` so `pure` could wrap it again. A producer that can fail now feeds
 * the fold directly, and one that cannot is unaffected when it later can.
 *
 * @template {Operation} O
 * @template T
 * @template {Operation} Q
 * @template S
 * @template E
 * @param {Effect<O, List<T>, E>} items
 * @param {S} init
 * @param {(item: T) => (state: S) => Effect<Q, S, E>} f
 * @returns {Effect<O | Q, S, E>}
 */
export const foldStep = (items, init, f) => {
    /** @type {Fold<T, Effect<Q, S, E>>} */
    const op = item => acc => step(acc, f(item))
    return step(items, fold(op)(pureOk(init)))
}

/**
 * Runs `f(item)` for each item in order, stopping at the first failure and
 * propagating it. The `void` accumulator sibling of {@link foldStep}.
 *
 * Stopping is the difference against the `Result`-blind `forEachStep` this
 * replaced: that one ran every item whatever each answered, because its `void`
 * accumulator had nothing to carry a failure in — and TypeScript's `void`
 * return position accepts a `Result`-valued effect silently, so the discard
 * does not even show up as a type error.
 *
 * @type {<O extends Operation, T, Q extends Operation, E>(
 *     items: Effect<O, List<T>, E>,
 *     f: (item: T) => Effect<Q, void, E>
 * ) => Effect<O | Q, void, E>}
 */
export const forEachStep = (items, f) =>
    foldStep(items, undefined, item => () => f(item))
