/**
 * Types for the core effect system.
 *
 * @module
 */

import type { Ok, Error, Result } from '../types/result/types.ts'
import type { Assert } from '../asserts/types.ts'
import type { Unknown as Json } from '../media/json/types.ts'
import type { Equal } from '../types/ts/types.ts'

/**
 * A command name paired with the signature a runner implements it at.
 *
 * **The return type is a {@link Result}, and that is a rule rather than a
 * convention every operation happens to follow.** A runner may decline any
 * command it was not given a handler for — `partialMatch` answers
 * `error(notImplemented(command))` through the command's own output — so an
 * operation whose return admitted no error would be a hole in that mechanism:
 * there would be nowhere to put the refusal. Every *host* operation already
 * returned `OpResult<…>` or `IoResult<…>` when this constraint was added, and
 * so did four of the six declared inside proofs — through a bare `Result`
 * rather than either alias, since those two are node conveniences. The two in
 * `./proof.f.mjs` returned a bare `number`, and the commit that added the rule
 * rewrote them.
 *
 * It is also the latch the whole representation now rests on. An operation
 * *cannot* be declared infallible, so every {@link Effect} built from one has a
 * `Result` to carry — which is what lets {@link Effect} name its error channel
 * rather than leaving it inside an opaque payload.
 */
export type Operation =
    readonly[string, (..._: readonly never[]) => Result<unknown, unknown>]

/**
 * The runner cannot dispatch this operation and has **not** started it.
 *
 * It is ordinary recoverable effect data rather than a fatal runner condition:
 * the program receives control back and decides what an incompatible runner
 * means for it — recover, choose a fallback operation, or treat it as fatal and
 * panic itself (`throw`, e.g. via `unwrap`). Escalation belongs to the program,
 * so the missing-handler path answers with `error(notImplemented)` rather than
 * panicking on the program's behalf.
 *
 * **It identifies the operation by command name only.** An operation's payload
 * may hold functions — `createServer`'s listener, `sandbox`'s thunk, `test`'s
 * body — so carrying it would break the serializability the asserts in
 * the asserts at the bottom of this file pin against the JSON data model.
 *
 * **It is not a security boundary.** A runner keeps its authority over
 * execution through a separate, out-of-band mechanism: it may interrupt or
 * terminate a program that is malicious, over budget, or violating host policy,
 * and nothing in the error channel obliges it to hand control back. A
 * capability the runner merely lacks is answered with this error; a refusal to
 * continue is an interruption, never dressed up as `NotImplemented`.
 *
 * **It is why there is no infallible effect.** Every {@link Do} node is
 * dispatched by a runner that may decline the command, so an effect that
 * declared no error channel would be describing today's runner rather than the
 * computation. That observation is what collapsed the representation into this
 * one type — see {@link Effect}.
 */
export type NotImplemented = readonly['notImplemented', string]

/**
 * An `Effect<O, T, E>` is the raw value: a {@link Pure} thunk yielding
 * `Result<T, E>`, or a {@link Do} node describing a command to perform. It is
 * plain data — compose effects with the combinators in
 * [`./module.f.mjs`](./module.f.mjs), which are eager wherever the head
 * is `Pure`.
 *
 * **The error channel is part of the representation, not a wrapper over it.**
 * This used to be two types: a `RawEffect<O, T>` with an opaque payload, and an
 * `Effect<O, T, E>` alias for `RawEffect<O, Result<T, E>>`. The division was
 * described as *composition* against *representation*, and it was defended on
 * the grounds that the representation is generic over its payload by
 * definition — the runners, {@link match}, `runPure`, `do_`. That is true and
 * it is not a reason for two names: {@link Operation} requires a `Result`
 * return, so the payload a runner is generic over is *always* `Result<T, E>`
 * already. Naming its two halves costs nothing and lets every signature in the
 * system say which half it means.
 *
 * **`E` defaults to {@link NotImplemented}**, the one error every operation can
 * answer with, so the common case is written `Effect<Sandbox, T>`. An
 * operation's own failures extend the channel — `Effect<ReadFile, Vec,
 * IoChannel>`, that alias being the node standard of
 * `NotImplemented | IoError`.
 *
 * **`Effect<O, T, never>` is a claim, not an absence.** It says this code
 * absorbs its own failures *here* — an MCP handler turning one into a JSON-RPC
 * error response, a decoder turning one into `null`, a test body turning one
 * into a panic. A reader who thinks the absorption is wrong has something to
 * point at, which is what the opaque payload could not offer.
 *
 * The channel is where **short-circuiting** lives, not specifically where a
 * runner's refusal lives. A parse failure, a domain verdict, or a non-zero exit
 * code belongs in it for the same reason {@link NotImplemented} does: `step`
 * should stop the chain and carry it out.
 *
 * It widens and does not narrow, in both channels and in `O` — the asserts in
 * the asserts at the bottom of this file pin each direction, so an unhandled error
 * type is a compile error rather than a value nobody looked at.
 */
export type Effect<O extends Operation, T, E = NotImplemented> =
    Pure<T, E> | Do<O, T, E>

/**
 * A pure effect: an *already-computed* `Result<T, E>` behind a thunk.
 *
 * The thunk is a **discriminator, not a suspension**. {@link Effect} is a union
 * with no tag field, so telling its two cases apart needs a runtime test, and
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
 * A `lazy` constructor (`<T>(t: () => T): Effect<never, T> => t`) once existed
 * to advertise the thunk as a suspension. It was the identity function, and it
 * promised a deferral this representation does not keep; it has been removed.
 * Reintroducing it would reintroduce the contradiction, not fix one.
 */
export type Pure<T, E> =
    () => Result<T, E>

export type Pr<O extends Operation, K extends O[0]> =
    O extends readonly[K, (...args: infer P) => infer R] ? readonly[P, R] : never

/**
 * A {@link Do} node's continuation: given the command's output, produce the
 * rest of the effect.
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
export type Cont<out O extends Operation, T, E> =
    (_: Pr<O, O[0]>[1]) => Effect<O, T, E>

/**
 * A `Do` node: the command to perform, its payload, and the continuation to
 * resume with the command's output. Its runtime value is exactly this record,
 * and every reader destructures it by name —
 * `const { command, payload, continuation } = e`.
 *
 * It must be an object rather than a tuple, and that is not a style choice:
 * only object / function / mapped-type aliases may carry a variance annotation
 * (`TS2637` forbids `out` on a tuple), and the {@link Effect} union must be
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
export type Do<out O extends Operation, T, E> = {
    readonly command: O[0]
    readonly payload: Pr<O, O[0]>[0]
    readonly continuation: Cont<O, T, E>
}

export type Param<O extends Operation> = F<O>[0]

export type Return<O extends Operation> = F<O>[1]

/**
 * The success half of a {@link Result} type, and {@link ErrOf} the error half.
 *
 * These read an operation's *declared* return apart so that {@link Func} can
 * state the effect `do_` builds from it. {@link Operation} guarantees the
 * return is a `Result`, so neither is ever the `never` its fallback branch
 * names; and both distribute over the union, which is what makes
 * `Result<T, E>` decompose back into exactly `T` and `E`.
 */
export type OkOf<R> = R extends Ok<infer T> ? T : never

/** The error half of a {@link Result} type — see {@link OkOf}. */
export type ErrOf<R> = R extends Error<infer E> ? E : never

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

/**
 * What one decoding step of an effect yields: the finished `Result`, or the
 * operation's output `R` paired with the continuation to resume with.
 *
 * The `done` payload is the whole `Result`, not its `ok` half. An interpreter
 * is the one reader that must not short-circuit — a runner hands a failed
 * command's `error` back *through* the continuation, so the two channels only
 * separate above this layer.
 */
export type MatchResult<O extends Operation, T, E, R> =
    | readonly['done', Result<T, E>]
    | readonly['cont', R, Cont<O, T, E>]

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (...payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

/**
 * The effect-returning function `do_` builds for a single operation: its
 * payload in, an {@link Effect} whose two channels are the halves of the
 * operation's declared `Result` out.
 */
export type Func<O extends Operation> =
    (..._: Param<O>) => Effect<O, OkOf<Return<O>>, ErrOf<Return<O>>>

// ── The contract, checked rather than merely declared ────────────────────────
//
// The widening rules the layer rests on are pinned below at a concrete
// instantiation. The union rules are the subtle part: a "simplification" that
// unified an error channel instead of unioning it would still compile at the
// definition and fail only at some future call site, so each rule is written
// down as a check here. The combinator signatures themselves verify
// `./module.f.mjs`, so those asserts live downstream in `./proof.f.mjs`'s
// `signatures` proof rather than here.

/** @see {@link _WidensOperations} — a second command to widen the op-set with. */
type _AddOp = readonly['add', (a: number, b: number) => Result<number, NotImplemented>]

type _MulOp = readonly['mul', (a: number, b: number) => Result<number, NotImplemented>]

type _Add = Effect<_AddOp, number, NotImplemented>

// The representation *is* the two-case union a runner discriminates, with the
// `Result` inside the leaves rather than around them. This used to be two
// asserts — one that `Effect` was a transparent alias for a payload-generic
// `RawEffect`, and one naming the cases underneath. There is one type now, so
// there is one assert.
type _Cases = Assert<Equal<
    _Add,
    Pure<number, NotImplemented> | Do<_AddOp, number, NotImplemented>>>

// The error channel widens, which is what lets `step` union `E | F` instead of
// unifying the two sides: a branch that is passed through stays the very tuple
// it arrived as.
type _WidensError = Assert<_Add extends Effect<_AddOp, number, NotImplemented | string> ? true : false>

// ...and it widens in that direction only. A wider channel is not silently
// usable where a narrower one is declared, so an unhandled error type is a
// compile error rather than a value nobody looked at.
type _NarrowsError = Assert<Equal<
    Effect<_AddOp, number, NotImplemented | string> extends _Add ? true : false,
    false>>

// The success channel widens too — `catchStep` unions `T | R` for the same
// reason `step` unions the errors.
type _WidensOk = Assert<_Add extends Effect<_AddOp, number | string, NotImplemented> ? true : false>

// Covariance in `O` survives the channel becoming primitive, so an effect keeps
// composing with one that requests further commands.
type _WidensOperations = Assert<_Add extends Effect<_AddOp | _MulOp, number, NotImplemented> ? true : false>

// `NotImplemented` is JSON data. This is the assert the "command name only"
// rule exists to keep true: an operation's payload may hold functions, and
// admitting one here would fail this line. The dependency is type-only and
// confined to this assert — nothing in the effect system imports the JSON data
// model at runtime.
type _Serializable = Assert<NotImplemented extends Json ? true : false>
