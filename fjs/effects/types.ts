/**
 * Types for the core effect system.
 *
 * @module
 */

import type { Result } from '../types/result/types.ts'

/**
 * A command name paired with the signature a runner implements it at.
 *
 * **The return type is a {@link Result}, and that is a rule rather than a
 * convention every operation happens to follow.** A runner may decline any
 * command it was not given a handler for — `partialMatch` answers
 * `error(notImplemented(command))` through the command's own output — so an
 * operation whose return admitted no error would be a hole in that mechanism:
 * there would be nowhere to put the refusal. Every operation in the tree
 * already returned `OpResult<…>` or `IoResult<…>` when this constraint was
 * added; it writes down what was true and stops it drifting.
 *
 * It is also a latch. Afterwards a new operation *cannot* be declared
 * infallible, which is what lets `do_` produce an `Effect` by construction and
 * `Cont` return one, rather than by the author of each operation remembering.
 */
export type Operation =
    readonly[string, (..._: readonly never[]) => Result<unknown, unknown>]

/**
 * A `RawEffect<O, T>` is the raw value: a {@link Pure} thunk that yields `T`, or a
 * {@link Do} node describing a command to perform. It is plain data — compose
 * effects with the external `step`, which is eager wherever the head is
 * `Pure`.
 *
 * **This is the low-level representation.** Work that can fail is written
 * against `Effect<O, T, E>` (`./io/types.ts`), the `RawEffect<O, Result<T, E>>`
 * with an explicit error channel, which is the preferred high-level
 * abstraction — see [`./io/README.md`](./io/README.md). `RawEffect` is what that
 * alias and the combinators here are built from, and it stays public as such.
 *
 * **It was planned for deletion, and the plan was wrong.** The argument ran:
 * migrate every fallible thing to `Effect`, and once nothing infallible is
 * left, make the `Result`-carrying union primitive and this name has nothing
 * to describe. The migration happened — the standard channel got a name,
 * `Program` exit codes and `List` cells got channels, `cas/evo` stopped
 * nesting, `unwrapStep` stopped absorbing — and at the end the infallible
 * payloads had not gone away. They had sorted themselves into two kinds that
 * are *permanently* infallible:
 *
 * - **The representation itself**, which is generic over its payload by
 *   definition: the runners, {@link match}, `runPure`, and the combinators
 *   here. `<T>(e: RawEffect<O, T>) => …` cannot be `Result`-valued without
 *   ceasing to be generic.
 * - **Absorb points**, where a module converts a channel into its own
 *   vocabulary and nothing behind it should carry the node channel. An MCP
 *   handler is the clearest: the protocol *is* its error channel, a request's
 *   channel failure becomes `_errResponse(id)(internalError)`, and a
 *   notification has no response frame to put an error in — so
 *   `(value) => RawEffect<O, Response | null>` is the honest contract, and
 *   `Effect<O, Response | null, never>` would only wrap a value that cannot
 *   fail in an `ok` nobody reads.
 *
 * Deleting the name would put an `Ok` around roughly seventy such payloads to
 * remove one alias. The distinction it draws — composition against
 * representation — turned out to be the thing worth keeping, which is why
 * {@link Operation} now *requires* a `Result` return: that is the part of the
 * plan that was right, and it makes every operation fallible at the leaf
 * without making every effect fallible at the type.
 */
export type RawEffect<O extends Operation, T> =
    Pure<T> | Do<O, T>

/**
 * A pure effect: an *already-computed* `T` behind a thunk.
 *
 * The thunk is a **discriminator, not a suspension**. `RawEffect` is a union with
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
 *   can be decoded repeatedly, and under the first rule that costs nothing and
 *   changes nothing.
 *
 * A `lazy` constructor (`<T>(t: () => T): RawEffect<never, T> => t`) once existed
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
 * (`RawEffect<A>` <: `RawEffect<A | B>`), never the unsound narrowing. Anyone changing
 * the continuation representation must re-check this argument before keeping the
 * annotation.
 */
export type Cont<out O extends Operation, T> =
    (_: Pr<O, O[0]>[1]) => RawEffect<O, T>

/**
 * A `Do` node: the command to perform, its payload, and the continuation to
 * resume with the command's output. Its runtime value is exactly this record,
 * and every reader destructures it by name —
 * `const { command, payload, continuation } = e`.
 *
 * It must be an object rather than a tuple, and that is not a style choice:
 * only object / function / mapped-type aliases may carry a variance annotation
 * (`TS2637` forbids `out` on a tuple), and the raw `RawEffect` union must be
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
 * This is a transparent alias for `RawEffect`. It adds the tuple bound and
 * nothing else, so any tuple-valued effect satisfies it whether or not
 * `history` produced it — it names the convention at the signatures that
 * rely on it rather than enforcing it.
 *
 * Heterogeneous by design: each element has its own type, so this is not a
 * `List` and nothing that folds or maps a list applies to it.
 */
export type History<O extends Operation, H extends readonly unknown[]> =
    RawEffect<O, H>

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

/**
 * An {@link OperationMap} a runner may leave holes in: every handler it *does*
 * provide has the same type, and any of them may be absent.
 *
 * Partiality is opt-in, and deliberately not the default. A total map means a
 * runner that forgets a handler is a compile error, which is what should happen
 * to the Node runner; this type is for a runner that is *meant* to lack
 * operations — a virtual filesystem with no subprocesses, a mock that answers
 * the three commands its proof issues. An absent handler here is an answer
 * (`error(notImplemented)`), not an oversight.
 */
export type PartialOperationMap<O extends Operation, R> = {
    readonly [K in O[0]]?: (...payload: Pr<O, K>[0]) => R
}

/**
 * The runtime witness of `O`'s command set.
 *
 * A {@link PartialOperationMap} cannot say, at runtime, whether a command it
 * has no handler for is one the operation set declares — types are erased, so
 * an omitted `readFile` and a garbled `readFilee` reach the interpreter as the
 * same missing lookup. They are not the same thing: the first is a capability
 * this runner lacks and a program may recover from, the second is a `Do` node
 * whose `command` was never the one its type claimed. Telling them apart needs
 * `O`'s commands as data.
 *
 * Declare it as a record rather than an array — a `Record<O[0], null>` is
 * checked for *completeness*, so a command added to `O` and forgotten here is a
 * compile error, whereas an array literal only has its members checked and
 * drifts silently.
 */
export type CommandSet<O extends Operation> =
    Readonly<Record<O[0], null>>

/** `O`'s commands, in the form {@link match} tests membership against. */
export type Commands<O extends Operation> =
    readonly O[0][]

export type MatchResult<O extends Operation, T, R> =
    | readonly['done', T]
    | readonly['cont', R, Do<O, T>['continuation']]

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (..._: Param<O>) => RawEffect<O, Return<O>>
