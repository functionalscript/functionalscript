# 5. I/O

Formerly §5 of the main [spec README](../README.md); the section numbers are
kept so older references such as "§5.4" still resolve.

**Decision:** I/O is done with **effects**. A program never calls the outside
world; it *describes* the call as an ordinary FJS value and hands the
description to a **runner**, which performs the call and resumes the program
with the output. The VM therefore implements neither external functions nor
promises — an effect is built from objects and functions the VM already has,
and everything impure lives in the runner, which is host code rather than
FunctionalScript.

This is the model sketched in the old §5.3 (a request plus a continuation),
now realized and in production use: the `fjs` CLI itself is a program of this
shape, run by the Node runner
([`fjs/module.mjs`](../../fjs/module.mjs)). The earlier alternatives are recorded
in [§5.6](#56-earlier-alternatives-superseded).

Authoritative sources — this section describes them, they define the
behaviour:

|Source|Holds|
|------|-----|
|[`fjs/effects/types.ts`](../../fjs/effects/types.ts)|the `Effect` type and its invariants|
|[`fjs/effects/module.f.mjs`](../../fjs/effects/module.f.mjs)|`pure`, `do_`, `step` and the other combinators, `match`|

## 5.1. `Effect` — the value

```ts
type Effect<O extends Operation, T> = Pure<T> | Do<O, T>

// an already-computed `T` behind a thunk
type Pure<T> = () => T

// a request: what to perform, with what, and what to do with the output
type Do<O extends Operation, T> = {
    readonly command: O[0]
    readonly payload: Payload<O, O[0]>
    readonly continuation: (output: Output<O, O[0]>) => Effect<O, T>
}
```

(`Payload` and `Output` are written above for readability; the real types spell
both with the single conditional type `Pr<O, K>`, which projects an operation's
signature into `readonly[parameters, return]`.)

An `Effect<O, T>` is plain data that yields a `T` while performing commands
drawn from the operation set `O`. It has no methods, and the union carries no
tag field: `typeof e === 'function'` tells the two cases apart, which is the
only reason `Pure` is a thunk at all.

The thunk is therefore a **discriminator, not a suspension**. A `Pure` holds a
value that has already been computed; the thunk must be pure and total, and
nothing memoizes it, so it may be forced more than once. Everything that
*does* something is a `Do` node, and only a runner performs those. Hiding work
behind a `Pure` hides it from every runner and every mock, so it is a
correctness bug and not an optimization.

A `Do` node is where the old §5.3 `readonly[Input, Continuation]` went: the
same request-and-continuation pair, with the request split into a `command`
tag and its `payload` so that an interpreter can dispatch on the tag.

## 5.2. `Operation` — the interface to the host

```ts
type Operation = readonly[string, (..._: readonly never[]) => unknown]
```

An operation is a **name paired with a signature**: the signature's parameters
type the `payload`, its return type the value the continuation receives. It is
a type-level declaration only — there is no function to call.

Operation sets compose by union. `Effect` is covariant in `O`, so combining an
`Effect<A, _>` with an `Effect<B, _>` yields an `Effect<A | B, _>`: a program
accumulates the vocabulary it uses, and a runner must interpret at least that
much. A command is created with `do_`:

```js
export const readFile = do_('readFile') // Func<ReadFile>
```

**The language specifies no operations.** The set is the host's vocabulary, not
FunctionalScript's — filesystem, network, subprocess, console, clock and
randomness in [`NodeOp`](../../fjs/effects/node/types.ts), key-value slots in
[`MemOp`](../../fjs/effects/memory/types.ts). A new operation is a new type and a
new entry in each runner's map; it is never a new language feature.

Failures travel in the operation's return type — Node operations return
`IoResult<T> = Result<T, unknown>` — because FunctionalScript reserves `throw`
for panics and has no `try`/`catch`. Making that error channel part of `step`
itself is
[io-effect-migration](../../fjs/effects/todo/io-effect-migration.md).

## 5.3. Composition

`step` is the primitive: run `e`, then continue with `f` applied to its result.

```js
const x0 = step(a, f)
const x1 = step(x0, g)
return step(x1, h)
```

It is **not lazy**: it reads `e`'s shape immediately, so a `Pure` head is
forced and `f` is called where the composition is written; only the `Do` case
defers, by rebuilding the continuation around `f`. That is sound exactly
because of the `Pure` contract above — forcing an already-computed value
observes nothing — and it is why a `defer` combinator cannot exist here: the
`Pure`/`Do` tag has to be known before anything runs, and the union has no
third case meaning "not yet decided".

The remaining combinators are `step` specializations, and
[`fjs/effects/module.f.mjs`](../../fjs/effects/module.f.mjs) documents each one:
`mapStep` (a pure projection ending a chain), `historyStep` (carries earlier
values forward so a later link can read them without nesting), `foldStep` and
`forEachStep` (sequential iteration), `okStep` (the `Result` short-circuit).

Sequencing is thus ordinary function composition. `async`/`await`
([§3.4 of the roadmap](./README.md#34-syntactic-sugar)) is sugar for a
different mechanism and is not required to write, or to run, an effectful
program.

## 5.4. Runners

A runner is an interpreter: it walks the effect, performs each command, and
feeds the output back into the continuation. `match` holds the step every
runner shares — decode the node, then dispatch its command through an
`OperationMap`, the table that maps each name in `O` to a handler — and a
runner is that plus one world-specific line:

|Runner|World-specific step|Use|
|------|-------------------|---|
|[`asyncRun`](../../fjs/effects/module.mjs)|`await`|the base of every asynchronous runner|
|[`node`](../../fjs/effects/node/module.mjs)|`asyncRun` against the real Node globals|production I/O; the `fjs` CLI|
|[`mock`](../../fjs/effects/mock/module.f.mjs)|threads a state value: `state => effect => [state, result]`|synchronous, pure interpretation|
|[`node/virtual`](../../fjs/effects/node/virtual/README.md)|`mock` over an in-memory filesystem, consoles, network and clock|tests, deterministic and race-revealing|
|[`node/memory`](../../fjs/effects/node/memory/module.mjs)|`asyncRun` over a store owned by the operation map|the [`memory`](../../fjs/effects/memory) operations (`MemOp`), state that outlives an effect step|

The command dispatch is a lookup on data, so the same program runs against any
of them unchanged. **This is what became of dependency injection (old §5.1):
the runner is the injected dependency** — one seam for the whole program,
chosen at the top by the caller that runs the effect, instead of an I/O record
threaded through every function that might need it.

Note what the table already shows: whether I/O is asynchronous is a property of
the *runner*, not of the program or the language. The same effect is awaited by
the Node runner and executed synchronously by the virtual one.

## 5.5. Consequences for the VM

1. **No external functions.** A command is data; only the runner, which is host
   code, ever performs one.
2. **No promises.** The old §5.2 required them; effects do not. Promises appear
   inside `asyncRun` and the Node runner because Node's API is promise-based,
   and nowhere in the effect values themselves. [promise](./3380-promise.md)
   is therefore wanted for JavaScript interop, not for I/O, and is not a
   blocker for it.
3. **No mutable I/O state in the language.** A `mock` runner threads its state
   explicitly and returns the new one, so the ownership machinery of
   [mutability](./mutability.md) is not a prerequisite for I/O either.
4. **A suspended program is a value.** A `Do` node is an FJS object whose
   `continuation` is an FJS function, and [serialization](./serialization.md)
   makes a function's canonical representation an FJS value. Serializing a
   program that is waiting on I/O therefore needs no separate mechanism.

## 5.6. Earlier alternatives (superseded)

Kept for the record; all three are subsumed by the sections above.

- **Isolated I/O** — dependency injection of an I/O record. Required the VM to
  implement external functions. What survives: the injection idea, moved to the
  runner ([§5.4](#54-runners)).
- **Isolated asynchronous I/O** — the same, with promises. Dropped: nothing in
  the effect representation is asynchronous, so the promise requirement
  disappears with it ([§5.5](#55-consequences-for-the-vm)).
- **State machine with asynchronous requests** — a program as
  `readonly[Input, Continuation]`, performed by the host. **Chosen**, and
  implemented as `Effect` ([§5.1](#51-effect--the-value)).
