## retire-raw-effect. Make `RawEffect` internal to `fjs/effects`

**Priority:** P3
**Status:** open — design settled in #1640; two decisions still open (below).

### Goal

`RawEffect` stops appearing in consumer code. Every **composed** effect is an
`Effect<O, T, E>`, with `E = never` where nothing fails yet, and `RawEffect`
survives as what it always was: the representation — `Pure`, `Do`, `Cont`, the
runners, `match`/`runPure`, and what `unwrapStep` hands back.

**This is not "delete `RawEffect`".** `Effect<O, T, E>` is *defined* as
`RawEffect<O, Result<T, E>>`; deleting the name means making the
`Result`-carrying union primitive, which forces every continuation in the
system to hand back a `Result` and gives `List` cells, exit codes and runner
returns an `Ok` wrapper each. The division to aim for is **composition against
representation**, not fallible against infallible.

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

- [ ] **`cas/evo`'s layering.** `Evo.add` is
      `Effect<…, Result<Hash, string>, NotImplemented>` — two layers, with a
      doc arguing they must stay apart. Its sibling `revision` has one. Either
      `Effect<…, RevisionData, string>` (keeps today's meaning) or
      `Effect<…, Result<RevisionData, string>, NotImplemented>` (matches `add`,
      and is the one that can widen later without touching consumers).
- [ ] **Name the standard channel.** `IoChannel = NotImplemented | IoError`.
      `../../emergent_testing/types.ts` already reasons its way there in prose
      — "it fails the way node IO fails, and pinning it here keeps the type …
      free of a parameter every caller would have to thread through unchanged"
      — 50 spelled-out unions later. Naming it is what stops the `nothrow`
      cascade from ever running.

### Stages

Each stage is independently mergeable, and the consumer sweep is **one PR per
module**, as stage 4 was. The compiler does not catch the mistakes this
migration makes, so each module's proofs are re-read as part of its PR.

- [ ] **1. `IoChannel`.** Introduce the alias next to `IoError`/`IoResult` and
      collapse the 50 spelled-out unions onto it. Mechanical; unblocks the rest
      by making "cannot fail" → "fails like node IO" a no-op.
- [ ] **2. `Program`.** `Program<O> = (options) => Effect<O, 0, number>`.
      `RawEffect<O, number>` cannot say which numbers mean failure; `Result<0,
      number>` can, and `r[1]` is the exit code in **both** branches, so the
      boundary needs no `r[0] === 'ok' ? 0 : r[1]`. `errorExit` gets the honest
      `Effect<Write, never, number>` — it never succeeds. `fjs/module.f.mjs`
      carries a comment about a near-miss this makes unrepresentable: a
      `() => pure(0)` continuation reporting a server that never started as a
      clean exit.
- [ ] **3. `List` cells.** `List<O, T, E> = Effect<O, Next<O, T>, E>`.
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
- [ ] **4. Consumer sweep**, one module per PR, until `RawEffect` is imported
      nowhere outside `fjs/effects`.
- [ ] **5.** Delete this file.

### Non-goals

- Deleting `RawEffect`, or making the `Result`-carrying union primitive.
- Cancellation in the resource-cleanup sense. A fallible `List` cell lets a
  consumer stop; nothing tells an abandoned producer that it was abandoned.
- Changing `fjs/types/result`. The `Ok`/`Error` tuples stay exactly as they
  are; a conditional `Result<T, never> = T` would defeat narrowing inside every
  generic combinator and make `ok()` unwritable.

### Invariants

- `RawEffect` is the representation; `Effect` is what one composes.
- `E = never` means infallible **structurally** — a `pureOk` lift, a
  `catchStep` that handled everything — not "does not fail yet".
- Widening a channel is source-compatible for consumers that only chain.
- The channel is where short-circuiting lives, not specifically where a
  runner's refusal lives: a parse failure, a domain verdict and a non-zero exit
  code all belong in it.
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
