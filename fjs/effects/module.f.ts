/**
 * Core effect type constructors and combinators.
 *
 * An `Effect<O, T>` **is** the raw value — a `Pure` thunk (`() => T`) or a `Do`
 * node (`[command, payload, continuation]`). It is plain data with no methods.
 * Composition is provided externally by {@link step}. The optional
 * method-chaining wrapper lives in `fjs/effects/eff/module.f.ts`.
 *
 * **Exactly one function inspects the shape: {@link decode}** (the `Pure` thunk
 * vs. `Do` tuple layout). {@link step} wraps it; interpreters and proofs go
 * through `decode` (or {@link match}) instead of inspecting a value. No second
 * `typeof value === 'function'` check may appear anywhere, so the representation
 * can change without touching them.
 *
 * Effect helpers come in two shapes. **Step adapters** return a continuation
 * `(t: T) => Effect<Q, R>` meant to be passed into a step — see {@link okStep}.
 * **Step variants** take the effect itself first, like {@link step} — see
 * {@link frameStep}.
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
 * enclosing scope. {@link frameStep} carries the value forward instead, so the
 * chain stays flat:
 *
 * ```ts
 * // avoid — nested only so `h` can still see `x`
 * step(a, x => step(f(x), y => h(x, y)))
 *
 * // prefer — the frame carries `x` forward as `param`
 * const x0 = frameStep(a, f)
 * return step(x0, ({ param: x, result: y }) => h(x, y))
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
 * step per item, and {@link frameStep} runs `f` inside `e`'s continuation.
 * Each writes that nesting down **once**, in one line, so that no caller ever
 * writes it again — that is what a combinator here is *for*. Without
 * {@link frameStep} the flat form would be unavailable the moment a later link
 * needed an earlier link's value.
 *
 * @module
 */

import { fold, type List } from '../types/list/module.f.ts'
import type { Result } from '../types/result/module.f.ts'

export type Operation =
    readonly[string, (..._: readonly never[]) => unknown]

/**
 * An `Effect<O, T>` is the raw value: a {@link Pure} thunk that yields `T`, or a
 * {@link Do} node describing a command to perform. It is plain data — compose
 * effects with the external {@link step}.
 */
export type Effect<O extends Operation, T> =
    Pure<T> | Do<O, T>

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
 * (`decode` → `match` → runner), so a `write` node's continuation is only ever
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
 * grows the op-set. Every reader still goes through {@link decode}, which reads
 * `e[0]` / `e[1]` / `e[2]`.
 */
export type Do<out O extends Operation, T> = {
    readonly 0: O[0]
    readonly 1: Pr<O, O[0]>[0]
    readonly 2: Cont<O, T>
}

export const pure = <T>(v: T): Effect<never, T> => () => v

/**
 * A lazy pure effect. Like {@link pure}, but takes a thunk and evaluates it on
 * demand instead of holding an already-computed value. Use this to produce the
 * next item of a list without instantiating the rest — the thunk runs only when
 * the effect is decoded (or stepped into).
 */
export const lazy = <T>(t: () => T): Effect<never, T> => t

export const doFull = <O extends Operation, T, K extends O[0]>(
    cmd: K,
    param: Pr<O, K>[0],
    cont: (input: Pr<O, K>[1]) => Effect<O, T>
): Effect<O, T> =>
    [cmd, param, cont]

/**
 * Composes effects: run `e`, then continue with `f` applied to its result.
 * The data-first primitive — raw `Effect` in, raw `Effect` out — and a thin
 * wrapper over {@link decode}. Chains as `step(step(e, f), g)`.
 */
export const step = <O extends Operation, T, Q extends Operation, R>(
    e: Effect<O, T>,
    f: (t: T) => Effect<Q, R>
): Effect<O | Q, R> => {
    const d = decode(e)
    return d.done
        ? f(d.result)
        : doFull<O | Q, R, O[0]>(d.command, d.payload, x => step(d.continuation(x), f))
}

/**
 * A captured call frame: everything observable about one call to a
 * continuation `f` — the `param` it was given and the `result` it produced.
 * `f`'s internals are not captured, and don't need to be.
 *
 * It is {@link frameStep}'s continuation reified: for `f: (p: P) => Effect<Q, R>`
 * the frame is `Frame<R, P>`, so the type reads straight off `f`'s signature.
 *
 * Frames chain through `param`, because `f` is handed the whole preceding
 * frame: `Frame<C, Frame<B, A>>` is three steps, and the `param` walk is how
 * far back a value lives — `frame.result`, `frame.param.result`,
 * `frame.param.param.result`. The chain bottoms out at a bare value rather
 * than an empty frame, so no unit is needed to start one.
 *
 * Heterogeneous by design: each link has its own type, so this is not a
 * `List` and nothing that folds or maps a list applies to it.
 */
export type Frame<R, P> = {
    readonly result: R
    readonly param: P
}

/**
 * Like {@link step}, but captures the call instead of discarding half of it:
 * runs `e` to get `p`, continues with `f(p)` to get `r`, and yields the
 * {@link Frame} `{ result: r, param: p }`.
 *
 * This is what a chain of named intermediate effects cannot otherwise express.
 * Each `step`'s continuation sees only the result of the effect it consumes, so
 * a later link has no way to reach an earlier one. `frameStep` keeps the
 * parameter, and the next destructuring names the parts:
 *
 * ```ts
 * const b = frameStep(a, decodeRevisionBlob(cas))
 * const c = step(b, ({ result: revision, param: hash }) => ...)
 * ```
 *
 * Chaining mimics an async function, one `await` per link — `const hash = ...`
 * then `const revision = ...`, with both still reachable at the end:
 *
 * ```ts
 * const f1 = frameStep(f0, hash => decodeRevisionBlob(cas)(hash))
 * const f2 = step(f1, ({ result: revision, param: hash }) => ...)
 * ```
 *
 * Reaching further back costs a `param` hop per link, so a value used many
 * links after it is bound reads as `frame.param.param.result`. When a chain
 * grows long enough for that to hurt, collapse it into a record of named
 * fields (`pure({ hash, revision } as const)`) and continue from there.
 */
export const frameStep = <O extends Operation, P, Q extends Operation, R>(
    e: Effect<O, P>,
    f: (p: P) => Effect<Q, R>
): Effect<O | Q, Frame<R, P>> =>
    step(e, param => step(f(param), result => pure({ result, param })))

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
 * The decoded form of an effect's next step: either a final `result`, or a
 * `command` to perform with its `payload` and the `continuation` to resume
 * with the command's output.
 */
export type Decoded<O extends Operation, T> =
    | { readonly done: true, readonly result: T }
    | {
        readonly done: false,
        readonly command: Do<O, T>[0],
        readonly payload: Do<O, T>[1],
        readonly continuation: Do<O, T>[2],
    }

/**
 * Decodes an effect's next step: a pure result, or a command to perform.
 *
 * This is the only function that knows how an `Effect` is laid out (a thunk
 * `() => T` for `Pure`, a `[command, payload, continuation]` tuple for `Do`).
 * Interpreters and proofs must go through `decode` (or `match`) instead of
 * inspecting the value, so the representation can change without touching
 * them.
 */
export const decode = <O extends Operation, T>(e: Effect<O, T>): Decoded<O, T> =>
    typeof e === 'function'
        ? { done: true, result: e() }
        : { done: false, command: e[0], payload: e[1], continuation: e[2] }

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
    <O1 extends O, T>(effect: Effect<O1, T>): MatchResult<O1, T, R> => {
        const d = decode(effect)
        return d.done
            ? ['done', d.result]
            : ['cont', map[d.command](...d.payload), d.continuation]
    }

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (..._: Param<O>) => Effect<O, Return<O>>
