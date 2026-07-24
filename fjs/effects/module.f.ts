/**
 * Core effect type constructors and combinators.
 *
 * An `Effect<O, T>` **is** the raw value — a `Pure` thunk (`() => T`) or a `Do`
 * node (`[command, payload, continuation]`). It is plain data with no methods.
 * Composition is provided externally by {@link step}, mirroring how
 * `fjs/types/function` makes `compose` the primitive and fluent wrappers optional sugar.
 * The optional method-chaining wrapper lives in `fjs/effects/eff/module.f.ts`.
 *
 * **Exactly one function inspects the shape: {@link decode}** (the `Pure` thunk
 * vs. `Do` tuple layout). {@link step} wraps it; interpreters and proofs go
 * through `decode` (or {@link match}) instead of inspecting a value. No second
 * `typeof value === 'function'` check may appear anywhere, so the representation
 * can change without touching them.
 *
 * Effect helpers are **step adapters**: functions that return a continuation
 * `(t: T) => Effect<Q, R>` meant to be passed into a step, never wrappers that
 * take the effect itself as an argument, so wrappers can compose them flat,
 * left-to-right, in evaluation order. (The underlying
 * `step(step(e, adapterA), adapterB)` reads inside-out.) See {@link okStep} for
 * an example.
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
 * effects with the external {@link step}, or a wrapper such as `fjs/effects/eff`.
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
