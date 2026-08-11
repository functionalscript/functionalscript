/**
 * Types for the core effect system.
 *
 * @module
 */

export type Operation =
    readonly[string, (..._: readonly never[]) => unknown]

/**
 * An `Effect<O, T>` is the raw value: a {@link Pure} thunk that yields `T`, or a
 * {@link Do} node describing a command to perform. It is plain data — compose
 * effects with the external `step`, which is eager wherever the head is
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
 *   that no runner ever sees and no `OperationMap` can interpret or mock.
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
 * (`match` → runner), so a `write` node's continuation is only ever
 * called with `void`; the op-set can grow without any continuation ever being
 * handed the wrong output. `out` enables only the widening direction
 * (`Effect<A>` <: `Effect<A | B>`), never the unsound narrowing. Anyone changing
 * the continuation representation must re-check this argument before keeping the
 * annotation.
 */
export type Cont<out O extends Operation, T> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T>

/**
 * A `Do` node: the command to perform, its payload, and the continuation to
 * resume with the command's output. Its runtime value is exactly this record,
 * and every reader destructures it by name —
 * `const { command, payload, continuation } = e`.
 *
 * It must be an object rather than a tuple, and that is not a style choice:
 * only object / function / mapped-type aliases may carry a variance annotation
 * (`TS2637` forbids `out` on a tuple), and the raw `Effect` union must be
 * covariant in `O` end to end. `command` and `payload` are indexed/conditional
 * types over `O` that TypeScript will not widen generically on their own —
 * annotating only {@link Cont} is not enough — so the whole node carries
 * `out O`. The same tag-dispatch soundness argument that justifies `Cont`'s
 * `out O` applies here (see {@link Cont}); widening only ever grows the op-set.
 *
 * The fields were once numeric (`0` / `1` / `2`) over a real `[cmd, param,
 * cont]` array, which is where the positional reads and the `Decoded` record
 * that wrapped them came from. Nothing needed the positions: the constraint
 * above is satisfied by any object type, so the numeric keys were paying a
 * tuple's price without being a tuple. Named fields make the node
 * self-describing at every read and leave no layout to memorize.
 */
export type Do<out O extends Operation, T> = {
    readonly command: O[0]
    readonly payload: Pr<O, O[0]>[0]
    readonly continuation: Cont<O, T>
}

/**
 * An effect whose result is a **history tuple**: the values a chain has bound so
 * far, newest first. `History<O, readonly[C, B, A]>` is three links deep, with
 * `A` bound earliest.
 *
 * This is a transparent alias for `Effect`. It adds the tuple bound and
 * nothing else, so any tuple-valued effect satisfies it whether or not
 * `history` produced it — it names the convention at the signatures that
 * rely on it rather than enforcing it.
 *
 * Heterogeneous by design: each element has its own type, so this is not a
 * `List` and nothing that folds or maps a list applies to it.
 */
export type History<O extends Operation, H extends readonly unknown[]> =
    Effect<O, H>

export type Param<O extends Operation> = F<O>[0]

export type Return<O extends Operation> = F<O>[1]

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
    | readonly['cont', R, Do<O, T>['continuation']]

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (..._: Param<O>) => Effect<O, Return<O>>
