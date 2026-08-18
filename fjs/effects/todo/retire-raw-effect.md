## retire-raw-effect. Make `RawEffect` internal to `fjs/effects`

**Priority:** P3
**Status:** open — design settled in #1640; two decisions still open (below).

### Goal

`RawEffect` stops appearing in consumer code. Every **composed** effect is an
`Effect<O, T, E>`, with `E = never` where nothing fails yet, and `RawEffect`
survives as what it always was: the representation — `Pure`, `Do`, `Cont`, the
runners, `match`/`runPure`, and what `unwrapStep` hands back.

The name can then go entirely (stage 5). `Effect<O, T, E>` is *defined* as
`RawEffect<O, Result<T, E>>`, so removing it means making the
`Result`-carrying union primitive — every continuation hands back a `Result`,
and anything infallible acquires an `Ok` wrapper. **Done first that is
expensive; done last it is free**, because by then nothing infallible is left
to wrap. The ordering below is not a matter of taste.

### Why

Three arguments, all about what happens later rather than what is true today.

**A runner may decline any command.** Since Stage 6, `partialMatch` answers
`error(notImplemented(command))` for any declared-but-unimplemented command.
So every effect holding a `Do` node is dispatched by a runner that may refuse
it, and `E = never` is a statement about *this implementation*, not about the
computation. Infallibility is contingent almost everywhere it is claimed.

**The two migrations are not comparable.** Widening `Effect<O, T, never>` to
`Effect<O, T, E>` leaves every consumer that merely chains untouched — `step`
is generic in the channel and unions it, so a continuation still sees only the
`ok` value — and errors at exactly the sites that *declared* the effect
infallible. The type-level asserts in `../io/types.ts` pin both directions:
the narrow channel is assignable to the wide one, and the reverse is rejected.

Widening a `RawEffect<O, T>` instead rewrites every consumer *body*, because
the raw `step`'s continuation goes from receiving `T` to receiving
`Result<T, E>` — and the compiler does not police it. `../../emergent_testing/types.ts`
records a case that already bit: `result` and `summary` "used to answer
`RawEffect<O, void>`, and TypeScript accepts an effect of any value type where
a `void` one is expected — so an implementation whose writes were fallible
type-checked while its failures went nowhere." That migration has been paid
once already, as stage 4 of [`io-effect-migration.md`](./io-effect-migration.md):
five PRs, 46 files, +962/−555, with real test failures found in review.

**One vocabulary instead of two.** `RawEffect` needs a parallel combinator set
— raw `step`/`mapStep`/`foldStep`/`forEachStep`/`history`/`historyStep` beside
the Io ones — and files touching both alias one set to disambiguate
(`step as rawStep`, `mapStep as rawMapStep`). `Effect<O, T, never>` composes
with the same helpers as every other `Effect`, and costs nothing at the call
site because `never | E` is `E`.

The `nothrow` precedent cuts both ways and is worth stating: declaring "cannot
fail" propagates transitively, and when a leaf changes, every enclosing
signature changes with it. C++ exception specifications and Java checked
exceptions both collapsed under that, with engineers declaring everything
throwing. What saves this design is that `step` unions the channel *without*
forcing a handler — Java's mistake was forcing **handling**, not forcing
**declaring** — and that the standard channel gets named once rather than
derived per function (see the `IoChannel` decision below).

### Measurements at the time of writing

- 40 non-`Result` `RawEffect<…>` occurrences outside `fjs/effects`, across 23
  files.
- 24 files import the raw combinators; most take only `pure` and `step`, which
  have direct equivalents in `pureOk` and the Io `step`. `match` and `runPure`
  are runner-level and legitimately stay raw.
- `NotImplemented | IoError` is spelled out 50 times, 41 of them as an `Effect`
  channel.
- Every effect-`List` already carries a `Result` payload — all 45 occurrences.
  There is no infallible stream, so a fallible cell costs no wrapper anywhere.

### Decisions still open

- [x] **`cas/evo`'s layering.** Settled by flattening: the nesting went, not
      the distinction. `EvoError` is a tagged tuple joining `NotImplemented` in
      one `EvoChannel`, so a rejected revision and an undispatchable operation
      stay tellable apart by tag — which is all any consumer used the layers
      for. The doc argued the two must not collapse, but what it described was
      choosing a *renderer*, which a union serves identically, while the
      layering cost `resolveParents` two hand-written short-circuits that the
      Io `foldStep` now does.
- [x] **Name the standard channel.** `IoChannel = NotImplemented | IoError`,
      in `../node/types.ts` beside `IoError` and `IoResult`. Done in stage 1.
      `../../emergent_testing/types.ts` already reasons its way there in prose
      — "it fails the way node IO fails, and pinning it here keeps the type …
      free of a parameter every caller would have to thread through unchanged"
      — 50 spelled-out unions later. Naming it is what stops the `nothrow`
      cascade from ever running.

### Stages

Each stage is independently mergeable, and the consumer sweep is **one PR per
module**, as stage 4 was. The compiler does not catch the mistakes this
migration makes, so each module's proofs are re-read as part of its PR.

- [x] **1. `IoChannel`.** The alias lives next to `IoError`/`IoResult`, all 50
      spelled-out unions collapsed onto it, and `IoResult<T>` is now
      `Result<T, IoChannel>`. "Cannot fail" → "fails like node IO" is a no-op
      for anything already declaring it.
- [x] **2. `unwrapStep` panics on a channel it never read.** It was generic in
      `E`, so it compiled however far the channel widened: one fallible read
      added upstream enlarged what every downstream `unwrapStep` crashed on,
      with no diagnostic. That is the `nothrow` defect in the one place where
      the consequence is a crashing program rather than a compile error.

      Fixed by requiring a `summary: (e: E) => string`. A renderer written for
      one channel cannot accept a wider one, so widening is a compile error at
      the site that chose to panic — pinned by `_UnwrapStepPinsItsChannel` in
      `../io/types.ts`, which fails if the argument ever goes back to accepting
      anything. Exhaustive enumeration at each site would have bought the same
      property for far more ceremony, and would not survive a channel that is a
      named alias rather than a literal union.

      The single library site — `../../emergent_testing/module.f.mjs`, whose
      test callback panics because `Test`'s contract is a raw
      `RawEffect<…, void>` with no channel to answer through — now passes
      `errorSummary`, so its scope is pinned to the node channel until someone
      changes it deliberately. The other 13 sites are proofs.

- [x] **3. `Program`.** `Program<O> = (options) => Effect<O, 0, number>`.
      `RawEffect<O, number>` could not say which numbers meant failure, so
      nothing short-circuited on one and `step(…, () => pure(0))` was a way to
      report a failed program as a clean exit — a mistake `fjs/module.f.mjs`
      carried a comment about, and which no longer type-checks.

      `T` is the literal `0`, which is what makes `exitCode` a projection
      rather than a branch: `r[1]` is the code on either side, so a runner reads
      it without asking which branch produced it while a caller that cares
      whether the program failed still asks `r[0]`. `errorExit` is
      `Effect<Write, never, number>` — it never succeeds, and the type says so.
      `emergent_testing`'s tail moved a non-zero code into the *error* branch,
      which is what a suite with failures means.

- [ ] **4. `List` cells.** `List<O, T, E> = Effect<O, Next<O, T>, E>`.
      `collectRead`, `detectStream`, `writeLoop` and three proof folds all
      hand-roll the same `if (t === 'error') return pure(error(v))`
      short-circuit, and it cannot be factored today because the fallibility
      lives in `T`, which a generic combinator cannot inspect. Moving it to the
      cell short-circuits once, in the library, and `Cas.read` gets the
      signature `(hash) => List<O, Vec, IoChannel>`. It also makes the
      "error item then dead tail" state unconstructible — today a failing
      producer must supply a tail no consumer will pull — so `Cas.read`'s rule
      that an error is "a distinct error *item* … never collapsed into
      end-of-stream" enforces itself instead of being legislated.
      Gives up per-item failure with continuation; nothing does that today.
- [ ] **5. Consumer sweep**, one module per PR, until `RawEffect` is imported
      nowhere outside `fjs/effects`.
- [ ] **6. Delete `RawEffect`.** Constrain `Operation`'s return type to a
      `Result` — it is `(..._: readonly never[]) => unknown` today, and all 27
      operations in the tree already return `OpResult<…>` or `IoResult<…>`; the
      only exception is `_AnyOp` in `../proof.f.mjs`, a proof operation that
      exists to exercise the raw layer. That promotes Stage 6's invariant from
      convention to type rule: a runner may answer `error(notImplemented)`
      through *any* command's output, which holds today only because every
      operation happens to declare a `Result` return.

      With the constraint in place `do_` produces an `Effect` by construction
      and `Cont<O, T, E>` returns one, so `Effect` is spelled directly as
      `Pure<Result<T, E>> | Do<O, T, E>`. `Pure` and `Do` stay; the union alias
      is what goes. `unwrapStep` is the one signature that needed a payload
      without a `Result`; it becomes `Effect<O, T, never>` — where the `never`
      records that the site *panicked*, not that nothing could fail. See stage 2,
      which lands first.

      **It is what makes precision optional.** The channel is one axis —
      `Effect<O, T, never>` ⊆ `Effect<O, T, IoChannel>` ⊆ `Effect<O, T, unknown>`,
      each assignable into the next — so how precisely a signature names its
      errors becomes a type *argument*, changeable in place. `E = unknown` is a
      legitimate entry point: everything composes, nothing must be enumerated,
      and tightening it later breaks no consumer that merely chains, because a
      precise channel flows wherever a loose one is declared. That is the
      opposite of widening, which cascades. `RawEffect<O, T>` is not the loose
      end of this axis; it is a different type constructor, off it entirely, so
      today reaching for any point on the dial is a rewrite rather than an edit.
- [ ] **7.** Delete this file.

### Non-goals

- Deleting `RawEffect` *early*. It is stage 6 and not stage 1 for the reason
  given under Goal — the cost is entirely a function of what infallible payloads
  are still around when it happens.
- Cancellation in the resource-cleanup sense. A fallible `List` cell lets a
  consumer stop; nothing tells an abandoned producer that it was abandoned.
- Changing `fjs/types/result`. The `Ok`/`Error` tuples stay exactly as they
  are; a conditional `Result<T, never> = T` would defeat narrowing inside every
  generic combinator and make `ok()` unwritable.

### Invariants

- `RawEffect` is the representation; `Effect` is what one composes — until
  stage 5, after which every operation returns a `Result` and the distinction
  has nothing left to mark.
- `E = never` means infallible **structurally** — a `pureOk` lift, a
  `catchStep` that handled everything — not "does not fail yet".
- Widening a channel is source-compatible for consumers that only chain.
- The channel is where short-circuiting lives, not specifically where a
  runner's refusal lives: a parse failure, a domain verdict and a non-zero exit
  code all belong in it.
- A panic names the errors it panics on. Nothing absorbs a whole channel
  generically, so widening a channel cannot quietly widen a crash.
- Nothing in the migration changes runtime behaviour except where a stage says
  so explicitly.

### Related

- [`io-effect-migration.md`](./io-effect-migration.md) — the six-stage
  migration this continues; stage 4 is the precedent for the consumer sweep.
- [`effect-list-fold.md`](./effect-list-fold.md),
  [`fold-stream-combinator.md`](./fold-stream-combinator.md) — both describe
  stream folds that stage 3 would subsume.
- `fjs/effects/io/types.ts` — `Effect`, and the asserts pinning the widening
  rules this plan depends on.
- `fjs/emergent_testing/types.ts` — the `RawEffect<O, void>` hazard, and the
  standard-channel argument, both in prose.
