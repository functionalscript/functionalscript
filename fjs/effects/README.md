# `Effect` — effects with an explicit error channel

`Effect<O, T, E>` ([`./types.ts`](./types.ts)) is a `Pure` thunk yielding
`Result<T, E>` or a `Do` node: the failure is part of the representation, not a
wrapper around it. One type, one module —
[`./module.f.mjs`](./module.f.mjs) holds the representation, its interpreters
and the combinators alike.

**It was two of each.** A payload-generic `RawEffect<O, T>` sat underneath, with
`Effect` an alias for `RawEffect<O, Result<T, E>>`, and the division was called
*composition* against *representation*. But an operation must return a `Result`,
so the payload a runner is generic over is always a `Result` — the second name
described no reachable case, while giving every combinator a `Result`-blind twin
that would run the next link after a failed one. Nothing "genuinely cannot
fail": a `List` cell, a `Program`'s exit code, and an MCP tool result were each
named here as such, and all three carry channels now.

The combinators lived in an `io/` subdirectory while that lasted, because their
`step` collided by name with the `Result`-blind one. It was never an IO layer —
the name came from its being the *fallible* half — and with the twins gone there
was neither a collision nor a second module to justify.

The migration is recorded in
[`./todo/io-effect-migration.md`](./todo/io-effect-migration.md) and is
complete: every operation declares a `Result` return, every runner answers with
one, and every consumer composes with `step` / `catchStep` / `resultStep`
instead of stating a policy per site.

## Why the layer exists

`throw` in FunctionalScript is a panic, and the language offers no
`try`/`catch`, so the effect system itself has to carry the recovery path. It
once did not: the `step` that composed effects did not understand `Result`, and
a continuation that ignored its argument ran on the success path whether or not
the previous effect failed.

```js
const a = writeFile(...)
const b = step(a, () => console('written'))
```

`writeFile` could return an error and `'written'` was still printed. The code
looked like an ordinary sequence, but it meant "run the next effect
regardless". Every caller had to remember to inspect each `Result` by hand;
missing one silently changed control flow. That spelling no longer exists — the
`Result`-blind combinators are gone, and the one remaining way to say "whatever
it answered" is `resultStep`, which hands the answer over.

With the error-aware `step`, that same line means what it looks like:
`console('written')` runs only on `ok`, and an error propagates on its own. That
gives FunctionalScript the default error-propagation path other languages get
from exceptions or Rust's `?`, without giving it exceptions.

## The vocabulary

Three branch-aware operations, in [`./module.f.mjs`](./module.f.mjs):

- `step` — continue on `ok`, propagate the error. The normal path.
- `catchStep` — continue on `error`, preserve the success value. The error path.
- `resultStep` — continue with the complete `Result`. Both paths, explicitly.

The union rules follow `okThen` in
[`../types/result/module.f.mjs`](../types/result/module.f.mjs): error
types are **unioned, not unified**, so neither side is pre-widened and a branch
that is passed through stays the very tuple it arrived as. `step` unions the
error channel and replaces the success type; `catchStep` mirrors it, unioning
the success channel and replacing the error type; `resultStep` consumes both
branches and replaces both. `types.ts` pins each of those signatures at a
concrete instantiation, so a "simplification" that unified an error channel
fails there rather than at some future call site.

The composition API and the representation share one module: `pure`, `do_`,
`match`, `partialMatch` and `runPure` sit beside `step` and the rest in
[`./module.f.mjs`](./module.f.mjs). They were split while that module also
exported `Result`-blind twins of `step`, `mapStep`, `history`, `historyStep`,
`foldStep` and `forEachStep`, since the names collided. The twins are gone, and
so is the split.

### `resultStep` is the primitive

`resultStep` **is** the former raw `step`: a continuation that takes the whole
`Result<T, E>` and returns an effect. `step` and `catchStep` are written in
terms of it — each is this function with a tag test in front — so the
both-branches case is not a third variant beside them but the thing they are
derived from.

That direction used to be reversed. The general function lived in the
representation module with an opaque payload, and `resultStep` was it
re-exported under a narrower type; the narrower type was doing all the work,
because the payload was always a `Result` anyway. Now the function lives where
its type is honest, and nothing above it can spell the both-branches case by
accident.

`resultMapStep` is its trailing-projection form, as `mapStep` is `step`'s.
Reach for it where a projection decides the *outcome* — turning any answer into
a fixed one, replacing a channel wholesale — and for `mapStep` where only the
value is being transformed. `resultMapStep` is also the honest spelling for a
site that means to discard an error: the discarding is written down, in a
function that says it takes both branches.

`finallyStep` is declined on the principle that a derivable form earns a name by
being canonical vocabulary, and that one has not shown it is.

### `pureOk` / `pureError`, not `ok` / `error`

The two lifts enter the layer from a plain value — the other way in is an
operation, which now declares a `Result` return of its own. They are *not*
spelled `ok` / `error`: those names are
`fjs/types/result`'s, and a consumer that both builds bare `Result`s and lifts
them — which is every consumer during the migration — would have to alias one
pair at each import. `pure` is not free to shadow either; it is the raw lift,
and a module that uses both wants them distinguishable.

### The error types are unioned, not unified

`step`'s two error types union (`E | F`) rather than unifying, and an `error`
is handed back as the very tuple it arrived as rather than rebuilt to retag it
into a wider type. That is what lets adjacent links in one chain fail in
different ways, and it follows `okThen` (`fjs/types/result/module.f.mjs`), the
pure sibling of this bind.

This used to route through an `okStep` exported by the representation module —
an adapter whose only caller was `step`'s own body, one indirection away. It is
written here now, and that module has one export fewer.

## `NotImplemented`

`NotImplemented` says the runner cannot dispatch an operation and has not
started it. It is ordinary recoverable effect data, not a fatal runner
condition: the program gets control back and owns the policy — recover, choose a
fallback operation, or panic itself.

**By command name only.** An operation's payload may hold functions —
`createServer`'s listener, `sandbox`'s thunk, `test`'s body — so carrying it
would break the serializability claim. `types.ts` pins that claim as a
type-level assert against the JSON data model rather than leaving it as a
comment, so a later payload field fails to compile.

**Not a security boundary.** A runner keeps its authority over execution through
a separate, out-of-band mechanism: it may interrupt or terminate a program that
is malicious, over budget, or violating host policy, and nothing in the error
channel obliges it to hand control back. The two mechanisms must not be
conflated in either direction — a capability the runner merely lacks is answered
with `NotImplemented`, never by killing the program, and a refusal to continue
is an interruption, never dressed up as `NotImplemented`.

## Where an operation lives

An operation belongs to the host that alone can perform it, and to
[`./common/`](./common/module.f.mjs) when no host owns it. `all`, `await`,
`fetch`, `import`, `now` and `sandbox` describe what a JavaScript *realm* can do
— hold a value, wait for a promise, measure a call, link a module — so the Node
runner, the browser runner and the virtual runner each implement the same
command at the same contract. `readFile`, `write`, `exec`, `createServer` and
`test` describe what a *host* can do, and stay in [`./node/`](./node/types.ts).

The line is not bookkeeping. It is what lets a program state that it needs
nothing host-specific and then be run by either host: the browser proof runner
(`fjs/emergent_testing/browser/module.f.mjs`) performs only `CommonOp` plus two
operations of its own, which is why it and `fjs t` can share every line of proof
semantics between them. `./node/` re-exports every common name, so a consumer
that already imports one module for `readFile` keeps importing it for `sandbox`.

**Part of the interpretation is common too**, and
[`./common/module.mjs`](./common/module.mjs) holds it: `sandbox`'s
`try`/`catch`-and-measure, `await`'s promise test, and the `io` wrapper that
turns a thrown value into an `IoError`. None of them touches a host — a bare
JavaScript realm has `Promise`, a clock and a `catch` — and `sandbox` in
particular is the operation that actually *executes* a proof body, so a runner
that spelled it its own way would make a test suite mean different things in
different hosts. The two runners did have it byte-identical, with a comment in
one saying it matched the other; a comment is not a mechanism.

An interpreter lives beside the host it interprets — [`./node/module.mjs`](./node/module.mjs),
[`./browser/module.mjs`](./browser/module.mjs) — and the browser one implements
`CommonOp` and nothing else. There is no browser filesystem and no browser
stdout, and inventing spellings for them would describe a host that does not
exist; a page that needs an operation of its own composes its handlers on top of
that map, which is why `browserOperationMap` takes the composed runner rather
than closing over one of its own.

## Leaving the layer

Not every consumer is ready to compose. Two named policies exist so that a site
which has not adopted the layer still has to *say* what it does with a failure
rather than discard it:

- `unwrapStep` (here) — panic on the error branch. It belongs where the caller
  genuinely has no answer: a build tool that cannot read its own sources, a
  reporter that cannot reach stdout. It is one greppable name rather than an
  `unwrap` buried in a continuation, so a site that has not chosen a real
  policy is exactly a site this name marks. The library has none left; the
  remaining calls are in test harnesses, where a missing fixture is fatal.
- `exitStep` / `errorMessage` (`./node/module.f.mjs`) — a `NodeProgram`'s
  exit-code policy: report the failure on `stderr` and exit `1`.

Neither is composition, and neither should grow: a consumer that can do
something better with a failure wants `catchStep` or `resultStep`.

## What is deliberately absent

This section used to list `notImplemented`, `historyStep`, `foldStep` and
`forEachStep` as things the layer had not needed yet, to be shaped by their
first consumer. All four exist now, and the list outlived them; what follows is
what is still absent, and why.

- **No `finallyStep`.** It is `resultStep` plus a policy. A derivable form earns
  a name by being canonical vocabulary, and no repeated policy has shown up to
  make this one canonical.
- **No `defer`.** `(() => Effect<O, T, E>) => Effect<O, T, E>` cannot be
  written: composition reads the `Pure` / `Do` tag before anything runs, and the
  union has no third case meaning "not yet decided". That is the representation,
  not a gap in this API — a caller who needs to name a composition without
  performing it keeps the ingredients and defers the step itself.
- **No second, `Result`-blind API.** There was one, and it is gone: see the top
  of this file for why one effect type means one set of combinators.
