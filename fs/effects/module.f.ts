/**
 * Core effect type constructors and combinators.
 *
 * @module
 */

import { fold, map, next, type List } from '../types/list/module.f.ts'

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

export const pure = <T>(v: T): Effect<never, T> => ({
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
 * This is the only function that knows how `Value` is laid out (a length-1
 * tuple for `Pure`, a `[command, payload, continuation]` tuple for `Do`).
 * Interpreters and proofs must go through `decode` (or `match`) instead of
 * inspecting the tuple, so the representation can change without touching
 * them.
 */
export const decode = <O extends Operation, T>({ value }: Effect<O, T>): Decoded<O, T> =>
    value.length === 1
        ? { done: true, result: value[0] }
        : { done: false, command: value[0], payload: value[1], continuation: value[2] }

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

/**
 * A lazy list of effects: each element is an `Effect<O, T>` that, when run, produces one
 * item `T`. Unlike the previous effect-driven cons stream, the list *shape* is pure and
 * lazy (`List`'s thunks), so a pure `List<T>` lifts into a `ListEffect` for free via
 * {@link pureList} (`map(pure)`) — no element is forced until the consumer pulls it, and
 * building the stream costs nothing up front.
 *
 * Because the shape is pure, a stream whose length depends on effect results (reading a
 * file until EOF, say) is expressed as an *unbounded* `ListEffect` that the consumer drives
 * with {@link foldStepWhile}, stopping early when a run effect yields a sentinel value (an
 * empty/EOF chunk, an error item, …).
 */
export type ListEffect<O extends Operation, T> = List<Effect<O, T>>

/**
 * Lifts a pure `List<T>` into a `ListEffect` lazily: every element becomes `pure(item)`.
 * The lift is exactly `map(pure)`, so nothing is forced until the consumer pulls it. The
 * result is over `never` operations (a pure value performs none) and so fits anywhere a
 * `ListEffect<O, T>` is expected.
 */
export const pureList: <T>(list: List<T>) => ListEffect<never, T> =
    map(pure)

/**
 * One step of driving a {@link ListEffect}: `['next', state]` to keep folding, or
 * `['stop', result]` to terminate early (e.g. on an EOF/error sentinel in a value).
 */
export type ListStep<S, R> =
    | readonly['next', S]
    | readonly['stop', R]

/**
 * Drives a {@link ListEffect} left to right. For each element it runs the effect, then
 * folds the produced item with `f`, threading state `S`. `f` returns an effect yielding
 * either `['next', state]` (continue) or `['stop', result]` (terminate early). When the
 * list runs out, `onEnd(state)` produces the final `R`.
 *
 * Early `stop` is what lets an *unbounded* `ListEffect` terminate: a chunked file read can
 * probe past EOF and the consumer stops on the first empty chunk. `f`'s own effects (op set
 * `O`) and the list's element effects (op set `P`) are tracked independently and unioned in
 * the result, so a consumer can perform new effects (e.g. `writeBytes`) per item.
 */
export const foldStepWhile =
    <O extends Operation, T, S, R>(
        f: (item: T) => (state: S) => Effect<O, ListStep<S, R>>,
        onEnd: (state: S) => Effect<O, R>,
    ) =>
    (init: S) =>
    <P extends Operation>(list: ListEffect<P, T>): Effect<O | P, R> => {
        const loop = (state: S) => (l: ListEffect<P, T>): Effect<O | P, R> => {
            const n = next(l)
            if (n === null) { return onEnd(state) }
            return n.first.step(item =>
                f(item)(state).step(s =>
                    s[0] === 'stop' ? pure(s[1]) : loop(s[1])(n.tail)))
        }
        return loop(init)(list)
    }
