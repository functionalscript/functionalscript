/**
 * Core effect type constructors and combinators.
 *
 * An `Effect<O, T>` **is** the raw value — a `Pure` thunk (`() => T`) or a `Do`
 * node (`[command, payload, continuation]`). It is plain data with no methods.
 * Composition is provided externally by {@link step}. The optional
 * method-chaining wrapper lives in `fjs/effects/eff/module.f.ts`.
 *
 * **Three functions read the `Pure` thunk vs. `Do` tuple layout** —
 * {@link step}, {@link match}, and {@link runPure} — plus the layout proof in
 * `fjs/effects/proof.f.ts` that pins the representation on purpose. Everything
 * else, interpreters included, goes through `match` or `runPure`. The count is
 * the point: a `typeof e === 'function'` check appearing in a fifth place is a
 * review flag, because the layout is only cheap to change while the readers
 * stay enumerable.
 *
 * A `decode` function (`(e: Effect<O, T>) => Decoded<O, T>`) once funnelled all
 * of that through a single `{ done, result }` / `{ done, command, payload,
 * continuation }` record, so that exactly one function held the shape test. It
 * has been removed. `Effect` is a function type unioned with an object type, so
 * `typeof e === 'function'` is already a complete discriminant — `decode` bought
 * no narrowing, only re-encoded it as a `done` flag to be re-narrowed one
 * indirection later, and `Decoded` was declared in terms of `Do[0]` / `[1]` /
 * `[2]` anyway. The price was a second vocabulary every consumer had to learn
 * for a shape it could already read. Reintroducing it would buy back the same
 * nothing.
 *
 * Effect helpers come in two shapes. **Step adapters** return a continuation
 * `(t: T) => Effect<Q, R>` meant to be passed into a step — see {@link okStep}.
 * **Step variants** take the effect itself first, like {@link step} — see
 * {@link historyStep}.
 *
 * **Do not nest steps.** Bind each intermediate effect to its own name, so a
 * sequence reads top-to-bottom in evaluation order:
 *
 * ```ts
 * // avoid — reads inside-out, and gains a level of indentation per link
 * step(a, x => step(f(x), y => step(g(y), z => h(z))))
 *
 * // prefer — flat, one name per link
 * const x0 = step(a, f)
 * const x1 = step(x0, g)
 * return step(x1, h)
 * ```
 *
 * When a later link needs a value from an earlier one, that is not a reason to
 * nest: a nested continuation only reaches back because it closes over the
 * enclosing scope. {@link historyStep} carries the value forward instead, so
 * the chain stays flat:
 *
 * ```ts
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
 * @module
 */

import { fold, type List } from '../types/list/module.f.ts'
import type { Option } from '../types/option/module.f.ts'
import type { Result } from '../types/result/module.f.ts'

export type Operation =
    readonly[string, (..._: readonly never[]) => unknown]

/**
 * An `Effect<O, T>` is the raw value: a {@link Pure} thunk that yields `T`, or a
 * {@link Do} node describing a command to perform. It is plain data — compose
 * effects with the external {@link step}, which is eager wherever the head is
 * `Pure`.
 */
export type Effect<O extends Operation, T> =
    Pure<T> | Do<O, T>

/**
 * A pure effect: an *already-computed* `T` behind a thunk.
 *
 * The thunk is a **discriminator, not a suspension**. `Effect` is a union with
 * no tag field, so telling its two cases apart needs a runtime test, and
 * `typeof e === 'function'` is it — wrapping the value in a function is what
 * makes that test work. Deferral is not what the thunk is for. A `Pure` never
 * holds work that has yet to happen; everything that *does* something is a
 * {@link Do} node, and only a runner performs those.
 *
 * Two rules follow, and the rest of the module leans on both:
 *
 * - **The thunk must be pure and total.** Work hidden behind it is an effect
 *   that no runner ever sees and no {@link OperationMap} can interpret or mock.
 * - **It may be called more than once.** Nothing memoizes it. The same effect
 *   can be decoded repeatedly — `Eff` re-forces the effect it wraps on each
 *   `.step` — and under the first rule that costs nothing and changes nothing.
 *
 * A `lazy` constructor (`<T>(t: () => T): Effect<never, T> => t`) once existed
 * to advertise the thunk as a suspension. It was the identity function, and it
 * promised a deferral this representation does not keep; it has been removed.
 * Reintroducing it would reintroduce the contradiction, not fix one.
 */
export type Pure<T> =
    () => T

export type Pr<O extends Operation, K extends O[0]> =
    O extends readonly[K, (...args: infer P) => infer R] ? readonly[P, R] : never

/**
 * A `Do` node's continuation: given the command's output, produce the rest of
 * the effect.
 *
 * The `out O` annotation asserts a covariance TypeScript cannot derive through
 * the conditional `Pr` type: the command's output sits in the *contravariant*
 * parameter position, so a bare function type would be measured contravariant
 * in `O`, but the effect system only ever *widens* `O` (grows the op-set), never
 * narrows it.
 *
 * **It is sound.** The `command` tag pins exactly which command's output the
 * continuation receives, and every interpreter dispatches on the tag first
 * ({@link match} → runner), so a `write` node's continuation is only ever
 * called with `void`; the op-set can grow without any continuation ever being
 * handed the wrong output. `out` enables only the widening direction
 * (`Effect<A>` <: `Effect<A | B>`), never the unsound narrowing. Anyone changing
 * the continuation representation must re-check this argument before keeping the
 * annotation.
 */
export type Cont<out O extends Operation, T> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T>

/**
 * A `Do` node: the `[command, payload, continuation]` triple, read positionally
 * as `[0]` / `[1]` / `[2]` — its runtime value is exactly that array. It is
 * declared as an object with numeric keys rather than `readonly[…]` for one
 * reason: only object / function / mapped-type aliases may carry a variance
 * annotation (`TS2637` forbids `out` on a tuple), and the raw `Effect` union
 * must be covariant in `O` end to end. The tag (`0`) and payload (`1`) are
 * indexed/conditional types over `O` that TypeScript will not widen generically
 * on their own — annotating only {@link Cont} (element `2`) is not enough — so
 * the whole node carries `out O`. The same tag-dispatch soundness argument that
 * justifies `Cont`'s `out O` applies here (see {@link Cont}); widening only ever
 * grows the op-set. The readers of this layout — {@link step} and
 * {@link match}, plus the layout proof — bind the three parts once with
 * `const { 0: command, 1: payload, 2: continuation } = e`. Array destructuring
 * is not available for the same reason the node is an object: without
 * `[Symbol.iterator]` in the declared type, `const [a, b, c] = e` is `TS2488`.
 */
export type Do<out O extends Operation, T> = {
    readonly 0: O[0]
    readonly 1: Pr<O, O[0]>[0]
    readonly 2: Cont<O, T>
}

export const pure = <T>(v: T): Effect<never, T> => () => v

export const doFull = <O extends Operation, T, K extends O[0]>(
    cmd: K,
    param: Pr<O, K>[0],
    cont: (input: Pr<O, K>[1]) => Effect<O, T>
): Effect<O, T> =>
    [cmd, param, cont]

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
 */
export const step = <O extends Operation, T, Q extends Operation, R>(
    e: Effect<O, T>,
    f: (t: T) => Effect<Q, R>
): Effect<O | Q, R> => {
    if (typeof e === 'function') { return f(e()) }
    const { 0: command, 1: payload, 2: continuation } = e
    return doFull<O | Q, R, O[0]>(command, payload, x => step(continuation(x), f))
}

/**
 * An effect whose result is a **history tuple**: the values a chain has bound so
 * far, newest first. `History<O, readonly[C, B, A]>` is three links deep, with
 * `A` bound earliest.
 *
 * This is a transparent alias for {@link Effect}. It adds the tuple bound and
 * nothing else, so any tuple-valued effect satisfies it whether or not
 * {@link history} produced it — it names the convention at the signatures that
 * rely on it rather than enforcing it.
 *
 * Heterogeneous by design: each element has its own type, so this is not a
 * `List` and nothing that folds or maps a list applies to it.
 */
export type History<O extends Operation, H extends readonly unknown[]> =
    Effect<O, H>

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
 * ```ts
 * const b = historyStep(history(a), decodeRevisionBlob(cas))
 * const c = step(b, ([revision, hash]) => ...)
 * ```
 *
 * Chaining mimics an async function, one `await` per link — `const hash = ...`
 * then `const revision = ...`, with both still reachable at the end. It takes a
 * history and returns one, so it composes with itself to any depth; only the
 * entry point needs {@link history}:
 *
 * ```ts
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
 */
export const historyStep = <
    O extends Operation,
    P extends readonly unknown[],
    Q extends Operation,
    R
>(
    e: History<O, P>,
    // `Readonly<P>` is load-bearing: inferring `P` from a bare rest parameter
    // yields a *mutable*, labelled tuple (`[next: string]`), which then rejects
    // the `readonly` tuples every history is built from.
    f: (...p: Readonly<P>) => Effect<Q, R>
): History<O | Q, readonly[R, ...P]> =>
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
 */
export const history = <O extends Operation, T>(e: Effect<O, T>): History<O, readonly[T]> =>
    step(e, v => pure([v]))

export type Param<O extends Operation> = F<O>[0]

export type Return<O extends Operation> = F<O>[1]

export const do_ =
    <O extends Operation>(cmd: O[0]) =>
    (...param: Param<O>): Effect<O, Return<O>> =>
    doFull(cmd, param as Param<O>, pure)

/**
 * Sequentially threads a state value through an effect for each item in `items`.
 *
 * Given `f: item => state => Effect<O, state>`, `init: S`, and `items: [x₀, x₁, …]`,
 * builds `step(step(f(x₀)(init), f(x₁)), f(x₂))…` and yields a single
 * `Effect<O, S>` that produces the final state.
 *
 * Sequential — each step depends on the previous state. Compare to `all`,
 * which fans out independent effects.
 */
export const foldStep =
    <O extends Operation, T, S>(f: (item: T) => (state: S) => Effect<O, S>) =>
    (init: S) =>
    (items: List<T>): Effect<O, S> =>
        fold<T, Effect<O, S>>(item => acc => step(acc, f(item)))(pure(init))(items)

/**
 * Sequentially runs `f(item)` for each item in `items`, discarding intermediate
 * results. The `void` accumulator sibling of `foldStep`.
 */
export const forEachStep =
    <O extends Operation, T>(f: (item: T) => Effect<O, void>) =>
    (items: List<T>): Effect<O, void> =>
    foldStep((item: T) => () => f(item))(undefined)(items)

/**
 * A step adapter for the `error` short-circuit: `error` → pass it through
 * unchanged as `pure`, `ok` → continue with `f`. Collapses the hand-written
 * `r[0] === 'error' ? pure(r) : f(r[1])` check that recurs at every site
 * chaining `Effect<O, Result<T, E>>` steps.
 */
export const okStep =
    <T, E, O extends Operation, R>(f: (value: T) => Effect<O, Result<R, E>>) =>
    (r: Result<T, E>): Effect<O, Result<R, E>> =>
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
 */
export const runPure = <O extends Operation, T>(e: Effect<O, T>): Option<T> =>
    typeof e === 'function' ? [e()] : []

/**
 * An operation map whose entries take a command's payload and return some
 * output `R`. Generalizes `ToAsyncOperationMap` (`R = Promise<…>`) and the
 * curried `MemOperationMap` (`R = (state) => [state, …]`).
 */
export type OperationMap<O extends Operation, R> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => R
}

export type MatchResult<O extends Operation, T, R> =
    | readonly['done', T]
    | readonly['cont', R, Do<O, T>[2]]

/**
 * Decodes an effect's next step and dispatches its command to `map`,
 * returning either the final result or the operation's output `R` paired
 * with the continuation. The one world-specific step — `await` for async
 * runners, state threading for sync ones — is left to the caller, so every
 * interpreter loop is this skeleton plus a single eliminator line.
 */
export const match =
    <O extends Operation, R>(map: OperationMap<O, R>) =>
    <O1 extends O, T>(e: Effect<O1, T>): MatchResult<O1, T, R> => {
        if (typeof e === 'function') { return ['done', e()] }
        const { 0: command, 1: payload, 2: continuation } = e
        return ['cont', map[command](...payload), continuation]
    }

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (..._: Param<O>) => Effect<O, Return<O>>
