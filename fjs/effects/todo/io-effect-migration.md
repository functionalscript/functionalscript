## io-effect-migration. Migrate effects to explicit Result semantics

**Priority:** P3
**Status:** open

### Goal

Most host-facing effects already return `Result`, and unsupported operations
should eventually be ordinary recoverable control flow rather than a fatal
runner condition. Introduce a staged migration from the current low-level
`Effect<O, T>` toward a normal effect abstraction with an explicit error
channel.

The end state is that effects are **recoverable without `try`/`catch`**.
FunctionalScript reserves `throw` for panics/programming errors and does not
offer `try`/`catch` as its ordinary error-handling mechanism, so the effect
system itself must carry the recovery path: `step` propagates, `catchStep`
recovers, `resultStep` observes both branches. Nothing in ordinary effect code
should ever need to catch.

### Problem with the current design

Today `step` does not understand `Result`. This makes it very easy to
accidentally continue the success path after a failed operation:

```js
const a = writeFile(...)
const b = step(a, () => console('written'))
```

`writeFile` may return an error, but the continuation ignores its result, so
`console('written')` still runs. The code looks like a normal sequential
success path even though it actually means “run the next effect regardless of
whether `writeFile` succeeded”.

Callers must remember to inspect every `Result` manually or wrap continuations
with helpers such as `okStep`. Missing one check silently changes control flow.

With IoEffect-aware `step`, the same natural-looking code has the natural
semantics:

```js
const a = writeFile(...)
const b = step(a, () => console('written'))
```

`console('written')` runs only when `writeFile` returns `ok`; an error is
propagated automatically. Explicit error handling uses `catchStep`, and code
that needs the complete outcome uses `resultStep`.

### Default error propagation

The new design gives FunctionalScript a default error-propagation path similar
to exceptions in conventional languages or Rust's `?` operator:

```js
const a = writeFile(...)
const b = step(a, () => nextEffect(...))
```

If `a` succeeds, execution continues through `step`. If it fails, the error is
propagated without every caller having to inspect and forward the `Result`
manually.

This is especially important for FunctionalScript because `throw` is reserved
for panic/programming errors rather than ordinary recoverable failures, and
FunctionalScript does not provide `try`/`catch` as its normal error-handling
mechanism. `IoEffect` composition therefore becomes the structured replacement
for exception-style propagation:

- `step` is analogous to the normal path plus implicit propagation (`?` in
  Rust).
- `catchStep` explicitly recovers from an error.
- `resultStep` explicitly observes both success and error.

Ordinary code should therefore be able to write the success path linearly and
only mention errors at the places where it intentionally handles them.

During migration:

```ts
type IoEffect<O extends Operation, T, E> =
    Effect<O, Result<T, E>>
```

A basic effect may use `NotImplemented` as its only error. Operations with
their own failures extend that channel, for example:

```ts
IoEffect<ReadFile, Vec, NotImplemented | IoError>
```

`NotImplemented` means the runner cannot dispatch the operation and has not
started it. The program receives control back and decides what an
incompatible runner means for it: recover, choose a fallback operation, or
treat it as fatal and panic itself (`throw`, e.g. via `unwrap`). Within the
error channel, escalation belongs to the program: the missing-handler path
answers with `error(NotImplemented)`, not with a panic on the program's
behalf.

Runners nevertheless keep their authority over execution itself, through a
**separate mechanism, out of band of the error channel**: a runner may
interrupt or terminate a program attempting something malicious, exceeding a
resource budget, or violating host policy. The two mechanisms must not be
conflated in either direction. A capability the runner merely lacks is
answered with `NotImplemented`, never by killing the program; a refusal to
continue is an interruption, never dressed up as `NotImplemented` — nothing
in the error channel obliges the runner to hand control back. `NotImplemented`
is therefore not a promise that the program always regains control, and it is
not a security boundary.

### Where the `Result` envelope lives

**Decision: the `Result` is part of the operation's declared return type**, not
something a constructor wraps around a raw operation. A `Do` node's
continuation accepts exactly the operation's declared output
(`Pr<O, K>[1]` in `fjs/effects/types.ts`), so for `error(NotImplemented)` to
arrive "through the normal effect continuation" (Stage 6) it must be a legal
value of that type. `Write` therefore becomes
`(stream, data) => Result<void, NotImplemented>`, and so on for every
operation.

The alternative — keep raw operation contracts and have constructors wrap with
`mapStep(do_(…), ok)` — would leave runners untouched in Stage 3, but it is a
dead end: Stage 6 would then have no typed channel through which a runner could
inject `NotImplemented`, and everything would be rewired a second time.

Two consequences follow, and both are Stage 3 work:

- **Runners change in Stage 3, mechanically.** Every runner handler for a
  currently-infallible operation starts wrapping its output in `ok(...)`.
  The already-fallible operations (`Fs`, `Fetch`, `Exec`, `Import`) need only
  their error type refined.
- Until Stage 6 lands, runners remain **total** over their declared operation
  maps: `NotImplemented` exists in the type model but no runner produces it
  yet.

### Target composition

The IoEffect API should use three branch-aware operations:

- `step` — continue on `ok`, otherwise propagate the error.
- `catchStep` — continue on `error`, otherwise preserve the success value.
- `resultStep` — continue with the complete `Result`.

The union rules are the subtle part, so they are pinned here. The precedent is
`okThen` (`fjs/types/result/module.f.mjs`), whose error types are **unioned,
not unified**, so neither side is pre-widened and a passed-through branch stays
the very tuple it arrived as:

```ts
step:       (e: IoEffect<O, T, E>, f: (t: T) => IoEffect<Q, R, F>)
                => IoEffect<O | Q, R, E | F>
catchStep:  (e: IoEffect<O, T, E>, f: (err: E) => IoEffect<Q, R, F>)
                => IoEffect<O | Q, T | R, F>
resultStep: (e: IoEffect<O, T, E>, f: (r: Result<T, E>) => IoEffect<Q, R, F>)
                => IoEffect<O | Q, R, F>
```

`step` unions the error channel and replaces the success type; `catchStep` is
its mirror — it unions the success channel and replaces the error type;
`resultStep` consumes both branches and replaces both.

Do not add `finallyStep` initially; it is derivable from `resultStep` and does
not add expressive power until real consumers demonstrate a repeated policy
worth naming.

The new `step` conflicts with today's raw-effect `step`. During migration, keep
the existing raw API intact and expose the IoEffect operations from a separate
module so they can already use their final names.

## Stage 1. Introduce `IoEffect`

- [ ] Add `IoEffect<O, T, E> = Effect<O, Result<T, E>>`.
- [ ] Add a small serializable `NotImplemented` error type identifying the
      unsupported operation **by command name only**. Payloads may contain
      functions (`createServer`'s listener, `sandbox`'s thunk, `test`'s body),
      so carrying the payload would break the serializability claim.
- [ ] Document `IoEffect` as the preferred high-level fallible abstraction
      while current `Effect<O, T>` remains the low-level representation.
- [ ] Add type/proof coverage without changing existing operations or
      consumers.

## Stage 2. Add IoEffect operations

**Blocked by:** Stage 1.

- [ ] Add IoEffect `step`, `catchStep`, and `resultStep` with the signatures
      pinned above.
- [ ] `step`: `ok` runs the continuation; `error` passes through.
- [ ] `catchStep`: `error` runs the continuation; `ok` passes through.
- [ ] `resultStep`: pass the complete `Result` to the continuation.
- [ ] Allow adjacent links to contribute different error types and union them
      per the signatures above.
- [ ] Add the **constructors** without which the three steps cannot be used:
      a success lift (`v => pure(ok(v))`) and a failure lift
      (`e => pure(error(e))`). These are entry points, not speculative API
      mirroring.
- [ ] Add the IoEffect `mapStep` (map over the `ok` value, pass `error`
      through). [`map-step-combinator.md`](./map-step-combinator.md) already
      establishes that trailing pure projections must not be spelled as steps;
      without an Io `mapStep` every converted site would regress to that
      spelling.
- [ ] Keep today's raw `step` and `okStep` available for old consumers during
      migration.
- [ ] Add proof coverage for propagation, recovery, joining, and mixed error
      types.

An Io-aware `historyStep` (carry the `ok` values forward, short-circuit on
`error`) is **expected** to be needed as soon as `fjs/cas` migrates — its
chains reach back to earlier values today. It may land here or at the start of
Stage 4, but it should not be a surprise when Stage 4's "only when consumers
require" triggers on the first consumer.

Every intermediate value remains one `IoEffect`; success and error are not
represented as a pair of effects.

## Stage 3. Make operations IoEffect-compatible

**Blocked by:** Stage 2.

- [ ] Convert operation contracts so the `Result` envelope is in the
      operation's declared return type and normal operation constructors
      return `IoEffect` (see "Where the `Result` envelope lives").
- [ ] Update every runner handler in the same change as its operation:
      infallible handlers wrap their output in `ok(...)`; fallible handlers
      keep their behavior with a refined error type.
- [ ] **Migrate operation by operation, fallible operations first.** For the
      already-fallible operations this stage is a pure type refinement
      (`unknown` → structured error). For currently-infallible operations
      (`Write`, `Read`, `Now`, `RandomInt`, `Sandbox`, `CreateServer`,
      `Listen`) it changes the value consumers receive: continuations that use
      the value break loudly at `tsc`, while continuations that discard it
      (`() => next`) keep compiling and silently ignore the new error channel —
      the very hazard motivating this migration. Convert those operations only
      together with a sweep of their value-discarding call sites, and
      consciously decide whether the trivially-total operations (`now`,
      `randomInt`) are worth the churn before Stage 6 gives their
      `NotImplemented` a consumer.
- [ ] Even operations without domain-specific failures include
      `NotImplemented`.
- [ ] Fallible operations extend the error channel with their own errors, e.g.
      `NotImplemented | IoError`.
- [ ] Avoid bare `unknown` as the long-term error type when it would erase the
      `NotImplemented` distinction; normalize host failures into a distinct
      error representation where needed.
- [ ] Preserve nested/domain `Result` only when `Result` is genuinely returned
      data rather than effect execution status (e.g. `SandboxResult.result`,
      which reports the sandboxed function's outcome, stays as data).
- [ ] Do not migrate all consumers in this stage.

## Stage 4. Migrate consumers

**Blocked by:** Stage 3.

- [ ] Migrate consumers module by module to IoEffect composition.
- [ ] Replace `step(e, okStep(f))` and equivalent manual propagation with
      IoEffect `step`.
- [ ] Use `catchStep` only for intentional recovery/fallback, including
      `NotImplemented` handling.
- [ ] Use `resultStep` where both branches genuinely matter.
- [ ] **Decide `Eff`'s fate before the first fluent consumer migrates.**
      `fjs/cas/module.f.mjs` composes via `eff(...).step(okStep(...))`; either
      `Eff` (`fjs/effects/eff/module.f.mjs`) grows an Io-aware `.step`, or
      those consumers migrate off `Eff` onto the flat IoEffect combinators.
      Pick one; do not leave cas half-fluent.
- [ ] Update the flat-step / "do not nest steps" guidance for the new
      semantics.
- [ ] Add IoEffect variants of other combinators only when real consumers
      require them; do not mirror the whole raw-effect API speculatively.
- [ ] Revisit `okStep`, `IoResult`, stream-fold helpers, and specialized
      recovery adapters as consumers migrate; remove redundant APIs when
      possible.
- [ ] Validate `npx tsc` and `fjs t` after each migration PR.

## Stage 5. Retire old `Effect`; rename `IoEffect` to `Effect`

**Blocked by:** Stage 4.

After public consumers use IoEffect semantics, make it canonical:

```ts
Effect<O, T, E = NotImplemented>
```

- [ ] Retire the old public `Effect<O, T>` abstraction.
- [ ] If the implementation still needs today's `Pure | Do` representation,
      keep it under an internal/private name such as `RawEffect` rather than
      maintaining two public effect abstractions.
- [ ] Rename `IoEffect` to `Effect` and make `NotImplemented` the default
      error type unless migration experience shows a better default.
- [ ] Make the IoEffect `step`, `catchStep`, and `resultStep` the canonical
      composition API.
- [ ] Remove migration-only raw APIs after their consumers are gone.
- [ ] Update docs, examples, AGENTS.md, and CHANGELOG as needed for the
      breaking change.

The rename silently changes what the second type parameter means — `T` becomes
the `ok`-branch value rather than the raw result. The stage relies on `tsc` to
catch stragglers: an un-migrated `Effect<O, IoResult<T>>` double-wraps into
`Result<IoResult<T>, NotImplemented>` and fails at its use sites. Verify the
sweep is actually clean (`npx tsc` over the whole repo) rather than assuming
it.

At this point `O` means the set of operations a computation may request, not a
guarantee that every runner implements all of them.

## Stage 6. Runners support `NotImplemented`

**Blocked by:** Stage 5.

- [ ] Allow a runner to omit an operation handler.
- [ ] A missing handler returns `error(NotImplemented(operation))` through the
      normal effect continuation.
- [ ] `NotImplemented` must be produced before the operation starts.
- [ ] **Rework `match` and its documented invariant.** `match` in
      `fjs/effects/module.f.mjs` asserts on a missing handler, with a
      deliberate doc argument that "a runner cannot resume a command it has no
      handler for, so there is nothing for a recovery branch to do." This stage
      inverts that argument: the runner *can* resume, with
      `error(NotImplemented)`. `match` is generic over `R` and cannot know
      every return type admits that value, so this needs either a partial
      operation-map type whose constraint guarantees every operation's return
      admits `error(NotImplemented)`, or a separate Io-aware match. The
      `assert` and the doc comment defending it are in scope, and per the
      module header the change touches one of the three sanctioned
      `Pure`/`Do` discriminators — update the header's count/argument
      accordingly.
- [ ] Supported operations keep their normal success or operation-specific
      error behavior.
- [ ] Add proof coverage showing that the program receives control after
      `NotImplemented` and can choose a fallback operation.
- [ ] Apply the same behavior to every runner/engine.

Until Stage 6 lands, `NotImplemented` may exist in the type model while
current runners remain total over their declared operation maps.

### Invariants

- A fallible computation is one effect, not a pair of success/error effects.
- `step` is the normal path.
- `catchStep` is the error path.
- `resultStep` explicitly handles both paths.
- Recovery never uses `throw`/`try`/`catch`; `throw` stays reserved for
  panics.
- `NotImplemented` is ordinary recoverable effect data, not a fatal runner
  condition.
- `NotImplemented` is not a security boundary: a runner may still interrupt
  or terminate a program (malice, policy, resource abuse) without handing
  control back.
- The `Result` envelope lives in the operation's declared return type.
- The program owns fallback policy — including the choice to panic (`throw`)
  instead of recovering.
- Each stage should be independently mergeable.

### Related

- [`map-step-combinator.md`](./map-step-combinator.md)
- [`effect-list-fold.md`](./effect-list-fold.md)
- [`fold-stream-combinator.md`](./fold-stream-combinator.md)
- [`../node/todo/ornotfound-combinator.md`](../node/todo/ornotfound-combinator.md)
- [`node-module-layering.md`](./node-module-layering.md)
- [`../../../todo/044-error-handling-pattern.md`](../../../todo/044-error-handling-pattern.md)
- `fjs/effects/module.f.mjs` — raw `step`, `okStep`, `match` (whose
  missing-handler `assert` Stage 6 reworks).
- `fjs/effects/eff/module.f.mjs` — the fluent wrapper whose fate Stage 4
  decides.
- `fjs/types/result/module.f.mjs` — `okThen`, the union-not-unify precedent
  for the signatures above.
