/**
 * Core effect type constructors and combinators.
 *
 * @module
 */

import { fold, type List } from '../types/list/module.f.ts'

export type Operation =
    readonly[string, (..._: readonly never[]) => unknown]

export type Effect<O extends Operation, T> = {
    value: Value<O, T>
    step: <Q extends Operation, R>(f: (p: T) => Effect<Q, R>) => Effect<O | Q, R>
}

export type Value<O extends Operation, T> =
    Pure<T> | Do<O, T>

export type Pure<T> =
    readonly[T]

export type DoKPR<O extends Operation, T, K extends string, PR extends readonly[unknown, unknown]> =
    readonly[K, PR[0], (_: PR[1]) => Effect<O, T>]

export type Pr<O extends Operation, K extends O[0]> =
    O extends readonly[K, (...args: infer P) => infer R] ? readonly[P, R] : never

export type DoK<O extends Operation, T, K extends O[0]> =
    DoKPR<O, T, K, Pr<O, K>>

export type Do<O extends Operation, T> =
    DoK<O, T, O[0]>

export const pure = < T>(v: T): Effect<never, T> => ({
    value: [v],
    step: f => f(v)
})

export const doFull = <O extends Operation, T, K extends O[0]>(
    cmd: K,
    param: Pr<O, K>[0],
    cont: (input: Pr<O, K>[1]) => Effect<O, T>
): Effect<O, T> => ({
    value: [cmd, param, cont],
    step: <Q extends Operation, R>(f: (p: T) => Effect<Q, R>) =>
        doFull<O | Q, R, K>(cmd, param, x => cont(x).step(f)),
})

export type Param<O extends Operation> = F<O>[0]

export type Return<O extends Operation> = F<O>[1]

export const do_ =
    <O extends Operation>(cmd: O[0]) =>
    (...param: Param<O>): Effect<O, Return<O>> =>
    doFull(cmd, param as Param<O>, pure)

export const begin: Effect<never, void> = pure(undefined)

/**
 * Sequentially threads a state value through an effect for each item in `items`.
 *
 * Given `f: item => state => Effect<O, state>`, `init: S`, and `items: [x₀, x₁, …]`,
 * builds `f(x₀)(init).step(f(x₁)).step(f(x₂)).…` and yields a single
 * `Effect<O, S>` that produces the final state.
 *
 * Sequential — each step depends on the previous state. Compare to `all`,
 * which fans out independent effects.
 */
export const foldStep =
    <O extends Operation, T, S>(f: (item: T) => (state: S) => Effect<O, S>) =>
    (init: S) =>
    (items: List<T>): Effect<O, S> =>
        fold<T, Effect<O, S>>(item => acc => acc.step(f(item)))(pure(init))(items)

/**
 * Sequentially runs `f(item)` for each item in `items`, discarding intermediate
 * results. The `void` accumulator sibling of `foldStep`.
 */
export const forEachStep =
    <O extends Operation, T>(f: (item: T) => Effect<O, void>) =>
    (items: List<T>): Effect<O, void> =>
    foldStep((item: T) => () => f(item))(undefined)(items)

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (..._: Param<O>) => Effect<O, Return<O>>

export type ListEffect<O extends Operation, T> =
    Effect<O, readonly[T, ListEffect<O, T>] | undefined>
