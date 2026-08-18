/**
 * The effect representation and its interpreters.
 *
 * An `Effect<O, T, E>` **is** the raw value — a `Pure` thunk
 * (`() => Result<T, E>`) or a `Do` node (`{ command, payload, continuation }`).
 * It is plain data with no methods. Composition is provided externally, by
 * [`./io/module.f.mjs`](./io/module.f.mjs).
 *
 * **This module is the representation; that one is the composition.** What
 * lives here is everything generic over an effect's shape rather than its
 * meaning: the constructor {@link pure}, the operation constructor {@link do_},
 * and the three eliminators {@link match}, {@link partialMatch}, and
 * {@link runPure}. `step`, `catchStep`, `resultStep`, `mapStep`, `history`,
 * `historyStep`, `foldStep` and `forEachStep` are all next door.
 *
 * **There used to be two of each.** A raw `step` composed effects with opaque
 * payloads, and an Io `step` composed the `Result`-carrying ones; the raw
 * `historyStep` carried each link's `Result` into the history rather than its
 * value, and the raw `forEachStep` ran every item whatever each one answered,
 * because a `void` accumulator accepts a `Result` silently. Those were traps
 * rather than a layer. Since {@link Operation} requires a `Result` return, every
 * effect in the system carries one, so the "raw" variants were the `Result`-blind
 * spelling of functions that always had a `Result` in front of them. The Io
 * `resultStep` *is* the former raw `step`, at the type that says so.
 *
 * **Three functions discriminate `Pure` from `Do`** — {@link _matchWith},
 * {@link runPure}, and the Io `resultStep` — plus the node proof in
 * `fjs/effects/proof.f.mjs` that pins the representation on purpose. Everything
 * else, interpreters included, goes through `match`, {@link partialMatch}, or
 * `runPure`. The count is the point: a `typeof e === 'function'` check
 * appearing in a fifth place is a review flag, because the representation is
 * only cheap to change while its readers stay enumerable.
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
 * See `./types.ts` for the type-level API, and
 * [`./io/README.md`](./io/README.md) for why the channel is part of it.
 *
 * @module
 *
 * @import { Option } from '../types/option/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Commands, Effect, ErrOf, Func, MatchResult, OkOf, Operation, OperationMap, PartialOperationMap } from './types.ts'
 */

import { assert } from '../asserts/module.f.mjs'
import { at } from '../types/object/module.f.mjs'

/**
 * Lifts an already-computed {@link Result} into an effect that performs no
 * command.
 *
 * It takes the `Result` rather than a bare value because that is what a `Pure`
 * holds: the two channels are the representation's, so a constructor that took
 * only a success would be `pureOk`, which is exactly what
 * [`./io/module.f.mjs`](./io/module.f.mjs) exports alongside `pureError`. Reach
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
