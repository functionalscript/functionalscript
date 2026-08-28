/**
 * The effect system: the representation, its interpreters, and the combinators
 * that compose it.
 *
 * An `Effect<O, T, E>` **is** the raw value — a `Pure` thunk
 * (`() => Result<T, E>`) or a `Do` node (`{ command, payload, continuation }`).
 * It is plain data with no methods; see [`./types.ts`](./types.ts) for the
 * type-level API and [`./README.md`](./README.md) for why the error channel is
 * part of it.
 *
 * **The three branch-aware operations are the whole composition vocabulary:**
 *
 * - {@link step} — continue on `ok`, propagate the `error`. The normal path.
 * - {@link catchStep} — continue on `error`, preserve the `ok`. The error path.
 * - {@link resultStep} — continue with the complete `Result`. Both paths.
 *
 * Around them: {@link pure} and the two lifts {@link pureOk} / {@link pureError}
 * that enter the layer, the projections {@link mapStep} and
 * {@link resultMapStep} that end a chain, {@link history} /
 * {@link historyStep} for a chain whose later links read earlier values, and
 * {@link foldStep} / {@link forEachStep} for iteration. The operation
 * constructor is {@link do_}, and the eliminators are {@link match},
 * {@link partialMatch} and {@link runPure}.
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
 * **This was two modules, and briefly two of each combinator.** A `./io/`
 * directory held the branch-aware set while this file held a `Result`-blind
 * `step`, `mapStep`, `history`, `historyStep`, `foldStep` and `forEachStep`
 * beside the representation. Those were traps rather than a layer: an operation
 * must return a `Result`, so every effect carries one, and a `step` that ran
 * its continuation whether or not the previous effect failed described no case
 * worth having. They are gone — {@link resultStep} *is* that former general
 * `step`, at the type that says what its continuation receives — and with the
 * name collision went the only reason for two modules. The directory was called
 * `io` because it was the fallible layer over a raw one; nothing in it was ever
 * specific to IO.
 *
 * **Three functions discriminate `Pure` from `Do`** — {@link resultStep},
 * {@link _matchWith} and {@link runPure} — plus the node proof in
 * `./proof.f.mjs` that pins the representation on purpose. Everything else,
 * interpreters included, goes through `match`, {@link partialMatch}, or
 * `runPure`. The count is the point: a `typeof e === 'function'` check
 * appearing in a fourth place is a review flag, because the representation is
 * only cheap to change while its readers stay enumerable. It used to be a
 * cross-module claim, with one of the three on the far side of the boundary.
 *
 * `match` and `partialMatch` are two entry points, not two discriminators:
 * they differ only in what a missing handler means and share `_matchWith` for
 * the shape test, so adding the partial variant left the count where it was.
 *
 * A `decode` function (`(e: Effect<O, T, E>) => Decoded<O, T, E>`) once funnelled
 * all of that through a single `{ done, result }` / `{ done, command, payload,
 * continuation }` record, so that exactly one function held the shape test. It
 * has been removed. An effect is a function type unioned with an object type, so
 * `typeof e === 'function'` is already a complete discriminant: `decode` bought
 * no narrowing, it re-encoded that narrowing as a `done` flag to be re-narrowed
 * one indirection later, and its `Decoded` record was declared in terms of the
 * node it claimed to hide. The price was a second vocabulary every consumer had
 * to learn for a shape it could already read. Reintroducing it would buy back
 * the same nothing — and with {@link Do} now carrying named fields there is not
 * even a positional layout left for it to insulate anyone from.
 *
 * **The composition rules:** bind each link in a sequence to its own name at one
 * level, do not nest steps, and break a call that does not fit one line after
 * `(` with one argument per line.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Fold } from '../types/function/operator/types.ts'
 * @import { Option } from '../types/option/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Commands, Effect, ErrOf, Func, IoChannel, IoError, IoErrorInfo, MatchResult, NotImplemented, OkOf, Operation, OperationMap, PartialOperationMap } from './types.ts'
 */

import { assert } from '../asserts/module.f.mjs'
import { fold } from '../types/list/module.f.mjs'
import { error, mapOk, ok } from '../types/result/module.f.mjs'
import { at } from '../types/object/module.f.mjs'

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
 * The `code` convention is node's in origin and not node's in reach: a browser
 * `DOMException` carries a string `name` and not a `code`, so it normalizes
 * through the message branch — correctly, since there is no OS code to report.
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
 * Lifts an already-computed {@link Result} into an effect that performs no
 * command.
 *
 * It takes the `Result` rather than a bare value because that is what a `Pure`
 * holds: the two channels are the representation's, so a constructor that took
 * only a success would be `pureOk`, which is exactly what
 * [`./module.f.mjs`](./module.f.mjs) exports alongside `pureError`. Reach
 * for those; this one is for the `Result` you already have in your hand — a
 * branch passing an incoming error through unchanged, or a runner's answer.
 *
 * **Both channels are read off the argument**, via {@link OkOf} / {@link ErrOf}
 * rather than by matching `Result<T, E>` directly. Inference against the union
 * cannot tell which half a one-sided argument belongs to — `pure(ok(v))` would
 * infer the error channel as `T` as readily as `never` — so the halves are
 * projected out of the concrete type instead. That is what makes `pureOk` land
 * on `Effect<never, T, never>` and `pureError` on `Effect<never, never, E>`.
 *
 * @type {<R extends Result<unknown, unknown>>(r: R) => Effect<never, OkOf<R>, ErrOf<R>>}
 */
export const pure = r =>
    // The thunk *is* the effect. TypeScript cannot see that `R` and
    // `Result<OkOf<R>, ErrOf<R>>` are the same type for a generic `R`, so the
    // one place the representation is constructed says so by hand.
    /** @type {any} */ (() => r)

/**
 * @type {<O extends Operation>(command: O[0]) => Func<O>}
 */
export const do_ = command => (...payload) => ({ command, payload, continuation: pure })

/**
 * Runs an effect that reaches its result without performing a command: `[r]`
 * for a {@link Pure}, empty for a {@link Do}. Forces the thunk in the `Pure`
 * case, which {@link Pure}'s contract makes free of consequence.
 *
 * The eliminator for callers that expect no operations at all — the other side
 * of {@link match}, which is for callers that intend to perform them.
 *
 * **The result is tagged on purpose**, and the tag is not the `Result`'s. An
 * `Option` distinguishes "reached a value" from "stopped at a command";
 * the `Result` inside it distinguishes success from failure. Collapsing them
 * would lose the case this exists to rule out — an effect that unexpectedly
 * stopped at a `Do` node — so `[r]` is a pure result and `[]` is a `Do`.
 *
 * `O` stays generic rather than narrowing to `Effect<never, T, E>`. An effect is
 * covariant in `O`, so `Effect<never, T, E>` is assignable to `Effect<O, T, E>`
 * and not the reverse — a continuation's result is always the wider type and
 * would be rejected. `Do<never, T, E>` is uninhabited besides, which would make
 * the empty case unreachable without a cast.
 *
 * @type {<O extends Operation, T, E>(e: Effect<O, T, E>) => Option<Result<T, E>>}
 */
export const runPure = e =>
    typeof e === 'function' ? [e()] : []

/**
 * Decodes an effect's next step and dispatches its command to `map`,
 * returning either the final result or the operation's output `R` paired
 * with the continuation. The one world-specific step — `await` for async
 * runners, state threading for sync ones — is left to the caller, so every
 * interpreter loop is this skeleton plus a single eliminator line.
 *
 * **An interpreter sees the whole `Result` and must not short-circuit on it.**
 * A runner answers a failed command through the *ordinary* continuation — that
 * is what makes `error(notImplemented)` recoverable — so the `done` payload
 * here is `Result<T, E>` rather than the `ok` half. Separating the channels is
 * the composition layer's job, one level up.
 *
 * **The handler is looked up with `at`, never with `map[command]`.**
 * `OperationMap<O, R>` pins `command` to `O[0]` at the type level, but a `Do`
 * node's `command` is runtime data — it can reach an interpreter from a decoded
 * payload or a deserialized continuation, where no type ever constrained it.
 * `map` is an ordinary object, so a plain index read resolves an inherited name
 * (`'constructor'`, `'toString'`, `'hasOwnProperty'`) to the `Object.prototype`
 * member instead of `undefined`, and the line below would then call it with the
 * node's payload: a value the type system promised was `(...payload) => R` turns
 * out to be an arbitrary inherited function, chosen by the same input that
 * supplies its arguments. `at` reads through `getOwnPropertyDescriptor`, which
 * only ever sees own properties, so such a command yields `null` and never a
 * callable.
 *
 * **A `null` handler means one of two different things**, and this is the only
 * place that can still tell them apart. With a total {@link OperationMap} every
 * `O1 extends O` the signature admits has its command in `map`, so a miss means
 * the node's `command` was never the `O1[0]` it claimed to be — a malformed
 * node, and a panic. With a {@link PartialOperationMap} a miss may instead be an
 * operation the runner deliberately does not implement, which is an *outcome*: a
 * program receives `error(notImplemented)` through the ordinary continuation and
 * decides for itself whether to recover, fall back, or panic. {@link partialMatch}
 * is the variant that distinguishes the two; this one keeps the strict reading,
 * because a total map has no second case to distinguish.
 *
 * The two share {@link _matchWith}, so `typeof e === 'function'` still appears
 * in exactly the three places the module header names.
 *
 * @template {Operation} O
 * @template R
 * @param {OperationMap<O, R>} map
 */
export const match = map =>
    _matchWith(/** @type {(command: O[0]) => R} */ (command => {
        assert(false, command)
    }))(map)

/**
 * {@link match} for a runner that is *meant* to lack operations.
 *
 * A command in `commands` with no handler in `map` is a capability this runner
 * does not have: `onMissing` builds the answer and the program resumes with it,
 * which is what lets `O` mean "the operations a computation may request" rather
 * than "the operations every runner implements". A command outside `commands`
 * is still a malformed node and still panics — an omitted handler and a garbled
 * `command` are not the same failure, and collapsing them would turn a probable
 * bug into a routine outcome.
 *
 * **`onMissing` is supplied by the caller because only the caller can build an
 * `R`.** `R` is the *runner's* wrapper — `Promise<…>` for an async loop,
 * `(state) => [state, …]` for a state-threading one — not the operation's
 * return type, so this function has no way to construct one. Each runner writes
 * the injector once, next to the loop that defines the shape.
 *
 * @template {Operation} O
 * @template R
 * @param {Commands<O>} commands
 * @param {(command: O[0]) => R} onMissing
 */
export const partialMatch = (commands, onMissing) =>
    _matchWith((/** @type {O[0]} */ command) => {
        assert(commands.includes(command), command)
        return onMissing(command)
    })

/**
 * The shared body of {@link match} and {@link partialMatch}: decode the node,
 * look the handler up by own property, and hand a miss to `onMissing`.
 *
 * @template {Operation} O
 * @template R
 * @param {(command: O[0]) => R} onMissing
 */
const _matchWith = onMissing =>
    /** @param {PartialOperationMap<O, R>} map */
    map =>
        /**
         * @template {O} O1
         * @template T
         * @template E
         * @param {Effect<O1, T, E>} e
         * @returns {MatchResult<O1, T, E, R>}
         */
        e => {
            if (typeof e === 'function') { return ['done', e()] }
            const { command, payload, continuation } = e
            const handler = at(command)(map)
            return [
                'cont',
                handler === null ? onMissing(command) : handler(...payload),
                continuation,
            ]
        }

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
 * runner producing `error(notImplemented)` does not go through here — that
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
 * (`./todo/map-step-combinator.md`). Without this, every such site would
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
 * The `IoChannel` renderer is `errorSummary` (`./node/module.f.mjs`); pass a
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
 * **The argument order is deliberately not `fold`'s** from `fjs/types/list`, and
 * the difference is what the two combinators are *for*. `fold` is a data
 * pipeline: it is curried `f`-first because the list is the thing being threaded
 * through, and nothing about it happens in time. A step variant is a sequencing
 * construct — this module's `do` notation — and reading one top-to-bottom is
 * reading the order the program executes in. The effect therefore has to come
 * first, because it is what happens first. Currying `f` ahead of `items` would
 * put the *body* of the loop above the thing it loops over, which is exactly the
 * inversion `do` exists to remove.
 *
 * That is also why the whole family — {@link step}, {@link historyStep},
 * `foldStep`, {@link forEachStep} — takes its effect first and breaks one
 * argument per line when it wraps: every such call is a statement list, and each
 * line is one statement in execution order.
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
