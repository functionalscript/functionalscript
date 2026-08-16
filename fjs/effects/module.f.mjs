/**
 * Core effect type constructors and combinators.
 *
 * An `Effect<O, T>` **is** the raw value — a `Pure` thunk (`() => T`) or a `Do`
 * node (`{ command, payload, continuation }`). It is plain data with no methods.
 * Composition is provided externally by {@link step}. The optional
 * method-chaining wrapper lives in `fjs/effects/eff/module.f.mjs`.
 *
 * **It is the low-level representation.** Fallible work is written against
 * `IoEffect<O, T, E>` — the `Effect<O, Result<T, E>>` with an explicit error
 * channel, and the preferred high-level abstraction (`./io/types.ts`, with the
 * rationale in [`./io/README.md`](./io/README.md)). The combinators here know
 * nothing of `Result`: {@link step} runs its continuation whether or not the
 * previous effect failed, so a chain of fallible effects must forward each
 * `Result` by hand — {@link okStep} is that forwarding written once. The
 * branch-aware `step` / `catchStep` / `resultStep` that make it automatic live
 * in `./io/module.f.mjs`, together with the `history` / `historyStep` /
 * `foldStep` / `forEachStep` a fallible chain needs; the ones here stay for
 * consumers still written against the raw contracts.
 *
 * **The composition rules below hold for both layers**, and a fallible chain
 * should follow them through the Io combinators — a raw `historyStep` over an
 * `IoEffect` carries each link's `Result` into the history rather than its
 * value, and the raw `forEachStep` runs every item whatever each one answered,
 * because a `void` accumulator accepts a `Result` silently.
 *
 * **Three functions discriminate `Pure` from `Do`** — {@link step},
 * {@link match}, and {@link runPure} — plus the node proof in
 * `fjs/effects/proof.f.mjs` that pins the representation on purpose. Everything
 * else, interpreters included, goes through `match` or `runPure`. The count is
 * the point: a `typeof e === 'function'` check appearing in a fifth place is a
 * review flag, because the representation is only cheap to change while its
 * readers stay enumerable.
 *
 * A `decode` function (`(e: Effect<O, T>) => Decoded<O, T>`) once funnelled all
 * of that through a single `{ done, result }` / `{ done, command, payload,
 * continuation }` record, so that exactly one function held the shape test. It
 * has been removed. `Effect` is a function type unioned with an object type, so
 * `typeof e === 'function'` is already a complete discriminant: `decode` bought
 * no narrowing, it re-encoded that narrowing as a `done` flag to be re-narrowed
 * one indirection later, and its `Decoded` record was declared in terms of the
 * node it claimed to hide. The price was a second vocabulary every consumer had
 * to learn for a shape it could already read. Reintroducing it would buy back
 * the same nothing — and with {@link Do} now carrying named fields there is not
 * even a positional layout left for it to insulate anyone from.
 *
 * Effect helpers come in two shapes. **Step adapters** return a continuation
 * `(t: T) => Effect<Q, R>` meant to be passed into a step — see {@link okStep}.
 * **Step variants** take the effect itself first, like {@link step} — see
 * {@link historyStep}. {@link mapStep} is the variant for the end of a chain:
 * a pure projection over an effect's result, which is a `step` that continues
 * with no further effect.
 *
 * **Do not nest steps.** Bind each intermediate effect to its own name, so a
 * sequence reads top-to-bottom in evaluation order:
 *
 * ```js
 * // avoid — reads inside-out, and gains a level of indentation per link
 * step(a, x => step(f(x), y => step(g(y), z => h(z))))
 *
 * // prefer — flat, one name per link
 * const x0 = step(a, f)
 * const x1 = step(x0, g)
 * return step(x1, h)
 * ```
 *
 * **A step call that does not fit one line breaks after `(`, one argument per
 * line.** This holds for every step variant — {@link step}, {@link mapStep},
 * {@link historyStep}, {@link foldStep}, {@link forEachStep} — and it is the
 * same rule as taking the effect first, written out at the call site. A step
 * variant is this module's
 * `do` notation: the arguments are a statement list in execution order, so each
 * one gets a line and the sequence reads down the page. Packing the leading
 * effect onto the `(` line and wrapping the rest beneath it hides which of them
 * runs first. The closing `)` may sit on its own line or trail the last
 * argument:
 *
 * ```js
 * return step(
 *     collectRead(cas.read(hash)),
 *     ([tag, value]) => pure(tag === 'error' ? null : decodeRevisionVec(value)))
 * ```
 *
 * When a later link needs a value from an earlier one, that is not a reason to
 * nest: a nested continuation only reaches back because it closes over the
 * enclosing scope. {@link historyStep} carries the value forward instead, so
 * the chain stays flat:
 *
 * ```js
 * // avoid — nested only so `h` can still see `x`
 * step(a, x => step(f(x), y => h(x, y)))
 *
 * // prefer — the history tuple carries `x` forward alongside `y`
 * const x0 = historyStep(history(a), f)
 * return step(x0, ([y, x]) => h(x, y))
 * ```
 *
 * Nesting is often forced by nothing more than a local declared inside a
 * continuation that does not depend on it. Hoist such locals above the chain
 * and the nesting usually dissolves on its own.
 *
 * That advice is for code *using* this module, and the combinators defined
 * here are what make it followable. The nesting has to exist somewhere: a name
 * cannot be bound to an effect that has not been produced yet, so `f(param)`
 * cannot become a `const` until `e` resolves. {@link step} recurses into
 * itself inside the continuation it rebuilds, {@link foldStep} composes one
 * step per item, and {@link historyStep} runs `f` inside `e`'s continuation.
 * Each writes that nesting down **once**, in one line, so that no caller ever
 * writes it again — that is what a combinator here is *for*. Without
 * {@link historyStep} the flat form would be unavailable the moment a later
 * link needed an earlier link's value.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { List } from '../types/list/types.ts'
 * @import { Option } from '../types/option/types.ts'
 * @import { Result } from '../types/result/types.ts'
 * @import { Fold } from '../types/function/operator/types.ts'
 * @import { Cont, Do, Effect, F, History, MatchResult, Operation, OperationMap, Param, Pr, Pure, Return, ToAsyncOperationMap } from './types.ts'
 */

import { assert } from '../asserts/module.f.mjs'
import { fold } from '../types/list/module.f.mjs'
import { at } from '../types/object/module.f.mjs'

/** @type {<T>(v: T) => Effect<never, T>} */
export const pure = v => () => v

/**
 * Composes effects: run `e`, then continue with `f` applied to its result.
 * The data-first primitive — raw `Effect` in, raw `Effect` out. Chains as
 * `step(step(e, f), g)`.
 *
 * **`step` is not lazy.** It reads `e`'s shape immediately, so a `Pure` head is
 * forced and `f` is called right there: `step(pure(v), f)` *is* `f(v)`,
 * evaluated where the composition is written rather than where the effect is
 * run. Only the `Do` case defers — the continuation rebuilt around `f` runs
 * when a runner reaches that node.
 *
 * That is sound rather than an oversight, and it is sound only because of
 * {@link Pure}'s contract: a `Pure` holds a value that has already been
 * computed, so forcing it early observes nothing, repeats nothing, and can
 * throw nothing. `step` never performs a `Do` node, which is where anything
 * real lives. Break the contract — hide work behind the thunk — and merely
 * composing a chain starts running the program.
 *
 * A composition cannot be suspended, and no combinator can fix that:
 * `defer: (() => Effect<O, T>) => Effect<O, T>` cannot be written here, because
 * the `Pure` / `Do` tag must be known before anything runs and the union has no
 * third case meaning "not yet decided". That is inherent to the representation,
 * not a gap in this module's API. A caller that needs to name a composition
 * without performing it yet has to keep the ingredients and defer the `step`
 * itself — `Eff` does exactly this, holding its history tuple as a thunk (`h`)
 * precisely because composing it eagerly is the one thing it cannot take back.
 *
 * @type {<O extends Operation, T, Q extends Operation, R>(e: Effect<O, T>, f: (t: T) => Effect<Q, R>) => Effect<O | Q, R>}
 */
export const step = (e, f) =>
    typeof e === 'function'
        ? f(e())
        : { ...e, continuation: x => step(e.continuation(x), f) }

/**
 * Applies a pure function to an effect's result: the functor `map` of the
 * effect monad, and a {@link step} whose continuation performs nothing further.
 *
 * Prefer it over the `step(e, t => pure(f(t)))` it abbreviates. The two are the
 * same value, but they read as different things: a `step` announces another
 * link in a sequence of effects, and a trailing pure projection is not one —
 * it is where the sequence ends. Saying so in the combinator's name keeps the
 * "one name per link" shape of a chain honest about how many effects it runs.
 *
 * **The operation set does not widen.** The result is `Effect<O, R>`, not
 * `Effect<O | Q, R>`, because a pure projection issues no commands — nothing a
 * runner has to know how to interpret is added by `f`. That is what separates
 * this from `step`, beyond the shorter spelling.
 *
 * A constant variant (`constStep(e, v)`) is deliberately absent: `mapStep(e,
 * () => v)` already reads clearly, and it keeps `v`'s evaluation inside the
 * continuation where `step` puts it, rather than moving it to where the
 * composition is written.
 *
 * @type {<O extends Operation, T, R>(e: Effect<O, T>, f: (t: T) => R) => Effect<O, R>}
 */
export const mapStep = (e, f) =>
    step(e, t => pure(f(t)))

/**
 * Like {@link step}, but keeps the values instead of discarding them: runs `e`
 * to get the history `p`, continues with `f(...p)` to get `r`, and yields
 * `[r, ...p]` — the same history with `r` prepended.
 *
 * This is what a chain of named intermediate effects cannot otherwise express.
 * Each `step`'s continuation sees only the result of the effect it consumes, so
 * a later link has no way to reach an earlier one. `historyStep` carries every
 * earlier value forward, and the next destructuring names the parts:
 *
 * ```js
 * const b = historyStep(history(a), decodeRevisionBlob(cas))
 * const c = step(b, ([revision, hash]) => ...)
 * ```
 *
 * Chaining mimics an async function, one `await` per link — `const hash = ...`
 * then `const revision = ...`, with both still reachable at the end. It takes a
 * history and returns one, so it composes with itself to any depth; only the
 * entry point needs {@link history}:
 *
 * ```js
 * const h0 = history(readHash(cas))
 * const h1 = historyStep(h0, hash => decodeRevisionBlob(cas)(hash))
 * const h2 = historyStep(h1, (revision, hash) => ...)
 * ```
 *
 * **Newest first.** A position is distance back from the current link, not
 * evaluation order, so a destructuring reads reverse-chronologically:
 * `([z, y, x]) => ...` binds `x` earliest. Reaching further back costs an index
 * rather than a traversal, but a long chain makes the positions hard to count.
 * When that starts to hurt, collapse it into a record of named fields
 * (`pure({ hash, revision } as const)`) and start a fresh history from there.
 *
 * `Readonly<P>` on `f`'s rest parameter is load-bearing: inferring `P` from a
 * bare rest parameter yields a *mutable*, labelled tuple (`[next: string]`),
 * which then rejects the `readonly` tuples every history is built from.
 *
 * @type {<O extends Operation, P extends readonly unknown[], Q extends Operation, R>(
 *     e: History<O, P>,
 *     f: (...p: Readonly<P>) => Effect<Q, R>
 * ) => History<O | Q, readonly[R, ...P]>}
 */
export const historyStep = (e, f) =>
    step(e, param => step(f(...param), result => pure([result, ...param])))

/**
 * Starts a history, lifting a plain result into a one-element tuple so that
 * {@link historyStep} can extend it.
 *
 * Creating a history is the *only* thing this does — every later link goes
 * through `historyStep`, which is what lets one combinator cover chains of any
 * length. Fusing the two (a step that both starts and extends) is what makes
 * chains stop composing: such a step nests its predecessor's tuple instead of
 * flattening it, so link two would have to be spelled differently from link
 * three.
 *
 * @type {<O extends Operation, T>(e: Effect<O, T>) => History<O, readonly[T]>}
 */
export const history = e =>
    step(e, v => pure([v]))

/**
 * @type {<O extends Operation>(command: O[0]) => (...payload: Param<O>) => Effect<O, Return<O>>}
 */
export const do_ = command => (...payload) => ({ command, payload, continuation: pure })

/**
 * Sequentially threads a state value through an effect for each item produced by
 * `items`.
 *
 * Given `f: item => state => Effect<Q, state>`, `init: S`, and an `items` that
 * yields `[x₀, x₁, …]`, builds `step(step(f(x₀)(init), f(x₁)), f(x₂))…` and
 * yields a single effect producing the final state.
 *
 * Sequential — each step depends on the previous state. Compare to `all`,
 * which fans out independent effects.
 *
 * **A step variant** (see the two shapes described in this module's header): the
 * effect comes first, as in {@link step} and {@link historyStep}. `items` is an
 * `Effect<O, List<T>>` rather than a bare `List<T>` because the list a caller
 * folds over is normally *produced* by an effect — `cas.list()`, a `readdir`.
 * Taking the plain list would force every such caller to open a continuation
 * just to name the list (`step(cas.list(), foldStep(…))`), which is the nesting
 * this module exists to keep out of call sites. A caller that already holds the
 * list lifts it with `pure`, which costs a wrapper but no indentation.
 *
 * `O` and `Q` are separate on purpose: the operations needed to produce the list
 * are rarely the ones the body performs, and the result unions them.
 *
 * **The argument order is deliberately not `fold`'s** from `fjs/types/list`, and
 * the difference is what the two combinators are *for*. `fold` is a data
 * pipeline: it is curried `f`-first because the list is the thing being threaded
 * through, and nothing about it happens in time. A step variant is a sequencing
 * construct — it is this module's `do` notation, and reading one top-to-bottom
 * is reading the order the program executes in. The effect therefore has to come
 * first, because it is what happens first. Currying `f` ahead of `items` would
 * put the *body* of the loop above the thing it loops over, which is exactly the
 * inversion `do` exists to remove.
 *
 * That is also why the whole family — `step`, `historyStep`, `foldStep`,
 * `forEachStep` — takes its effect first and breaks one argument per line when
 * it wraps (see this module's header): every such call is a statement list, and
 * each line is one statement in execution order.
 *
 * @template {Operation} O
 * @template T
 * @template {Operation} Q
 * @template S
 * @param {Effect<O, List<T>>} items
 * @param {S} init
 * @param {(item: T) => (state: S) => Effect<Q, S>} f
 * @returns {Effect<O | Q, S>}
 */
export const foldStep = (items, init, f) => {
    /** @type {Fold<T, Effect<O | Q, S>>} */
    const op = item => acc => step(acc, f(item))
    return step(items, fold(op)(pure(init)))
}

/**
 * Sequentially runs `f(item)` for each item produced by `items`, discarding
 * intermediate results. The `void` accumulator sibling of {@link foldStep}, and
 * a step variant on the same grounds.
 *
 * @type {<O extends Operation, T, Q extends Operation>(items: Effect<O, List<T>>, f: (item: T) => Effect<Q, void>) => Effect<O | Q, void>}
 */
export const forEachStep = (items, f) =>
    foldStep(items, undefined, item => () => f(item))

/**
 * A step adapter for the `error` short-circuit: `error` → pass it through
 * unchanged as `pure`, `ok` → continue with `f`. Collapses the hand-written
 * `r[0] === 'error' ? pure(r) : f(r[1])` check that recurs at every site
 * chaining `Effect<O, Result<T, E>>` steps.
 *
 * The effectful twin of `okThen` (`fjs/types/result/module.f.mjs`), down to how
 * its type is quantified. **The two error types are unioned, not unified**, and
 * `F` binds on the *second* arrow: `f` alone determines the value types, so one
 * `okStep(f)` adapts results carrying any error type, and the incoming error is
 * passed through as the very tuple it arrived as rather than being rebuilt to
 * retag it into a wider type. The IoEffect `step` (`./io/module.f.mjs`) is
 * exactly this adapter under raw `step`, and it is the union that lets adjacent
 * links there fail in different ways.
 *
 * @type {<T, E, O extends Operation, R>(f: (value: T) => Effect<O, Result<R, E>>) => <F>(r: Result<T, F>) => Effect<O, Result<R, E | F>>}
 */
export const okStep = f => r =>
    r[0] === 'error' ? pure(r) : f(r[1])

/**
 * Runs an effect that reaches its value without performing a command: `[t]` for
 * a {@link Pure}, empty for a {@link Do}. Forces the thunk in the `Pure` case,
 * which {@link Pure}'s contract makes free of consequence.
 *
 * The eliminator for callers that expect no operations at all — the other side
 * of {@link match}, which is for callers that intend to perform them.
 *
 * **The result is tagged on purpose.** Returning `T | null` would collapse two
 * distinct outcomes whenever `T` itself admits `null`: `runPure(pure(null))` and
 * `runPure(someDo)` would both be `null`, so a caller asserting `null` would
 * accept an effect that unexpectedly stopped at a command — exactly the case
 * this exists to rule out. `Option<T>` keeps them apart: `[null]` is a pure
 * `null`, `[]` is a `Do`.
 *
 * `O` stays generic rather than narrowing to `Effect<never, T>`. `Effect` is
 * covariant in `O`, so `Effect<never, T>` is assignable to `Effect<O, T>` and
 * not the reverse — a continuation's result is always the wider type and would
 * be rejected. `Do<never, T>` is uninhabited besides, which would make the empty
 * case unreachable without a cast.
 *
 * @type {<O extends Operation, T>(e: Effect<O, T>) => Option<T>}
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
 * A `null` handler is an invariant violation, not an outcome: every `O1 extends
 * O` the signature admits has its command in `map`, so reaching it means the
 * node's `command` was never the `O1[0]` it claimed to be. It therefore throws
 * (`assert`) rather than widening {@link MatchResult} with a variant no
 * type-correct caller could ever observe — a runner cannot resume a command it
 * has no handler for, so there is nothing for a recovery branch to do.
 *
 * @template {Operation} O
 * @template R
 * @param {OperationMap<O, R>} map
 */
export const match = map =>
    /**
     * @template {O} O1
     * @template T
     * @param {Effect<O1, T>} e
     * @returns {MatchResult<O1, T, R>}
     */
    e => {
        if (typeof e === 'function') { return ['done', e()] }
        const { command, payload, continuation } = e
        const handler = at(command)(map)
        assert(handler !== null, command)
        return ['cont', handler(...payload), continuation]
    }
