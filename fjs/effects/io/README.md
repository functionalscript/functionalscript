# IoEffect — effects with an explicit error channel

`IoEffect<O, T, E>` is `Effect<O, Result<T, E>>`: the raw effect from
[`../module.f.mjs`](../module.f.mjs) with its failure made part of the type.
It is the **preferred high-level abstraction for fallible work**; the raw
`Effect<O, T>` remains the low-level representation both it and the raw
combinators are built from.

This directory is the layer itself — the types ([`./types.ts`](./types.ts)) and
the composition API ([`./module.f.mjs`](./module.f.mjs)) — from the migration
planned in
[`../todo/io-effect-migration.md`](../todo/io-effect-migration.md). Every
operation now declares a `Result` return and every runner answers with one
(stage 3); what remains is migrating the consumers to compose with `step` /
`catchStep` / `resultStep` instead of stating a policy per site (stage 4).

## Why the layer exists

`throw` in FunctionalScript is a panic, and the language offers no
`try`/`catch`, so the effect system itself has to carry the recovery path.
Today it does not: raw `step` does not understand `Result`, and a continuation
that ignores its argument runs on the success path whether or not the previous
effect failed.

```js
const a = writeFile(...)
const b = step(a, () => console('written'))
```

`writeFile` may return an error and `'written'` is still printed. The code looks
like an ordinary sequence, but it means "run the next effect regardless". Every
caller must remember to inspect each `Result` by hand, or wrap the continuation
in `okStep`; missing one silently changes control flow.

With an `IoEffect`-aware `step`, that same line means what it looks like:
`console('written')` runs only on `ok`, and an error propagates on its own. That
gives FunctionalScript the default error-propagation path other languages get
from exceptions or Rust's `?`, without giving it exceptions.

## The vocabulary

Three branch-aware operations, in [`./module.f.mjs`](./module.f.mjs):

- `step` — continue on `ok`, propagate the error. The normal path.
- `catchStep` — continue on `error`, preserve the success value. The error path.
- `resultStep` — continue with the complete `Result`. Both paths, explicitly.

The union rules follow `okThen` in
[`../../types/result/module.f.mjs`](../../types/result/module.f.mjs): error
types are **unioned, not unified**, so neither side is pre-widened and a branch
that is passed through stays the very tuple it arrived as. `step` unions the
error channel and replaces the success type; `catchStep` mirrors it, unioning
the success channel and replacing the error type; `resultStep` consumes both
branches and replaces both. `types.ts` pins each of those signatures at a
concrete instantiation, so a "simplification" that unified an error channel
fails there rather than at some future call site.

The new `step` conflicts with the raw one, which is why these live in their own
module and can already use their final names. Stage 5 retires the raw public
abstraction and renames `IoEffect` to `Effect`.

### `resultStep` is raw `step`, and still earns its name

Expanded through the alias, `resultStep` **is** the raw `step` at the Io
instantiation — a continuation taking a `Result<T, E>` and returning an effect
is what raw `step` already offers — so it adds no branch behavior and is
implemented as that function with a narrower type. It is named anyway because
the three operations are the canonical vocabulary: a chain that spells the
both-branches case as a raw `step` reads as an escape from the layer, and from
stage 5, when the raw representation goes private, this is the public spelling
of that instantiation.

`finallyStep` is declined on the same principle read the other way — a
derivable form earns a name by being canonical vocabulary, and that one has not
shown it is.

### `pureOk` / `pureError`, not `ok` / `error`

The two lifts enter the layer from a plain value — the other way in is an
operation, which now declares a `Result` return of its own. They are *not*
spelled `ok` / `error`: those names are
`fjs/types/result`'s, and a consumer that both builds bare `Result`s and lifts
them — which is every consumer during the migration — would have to alias one
pair at each import. `pure` is not free to shadow either; it is the raw lift,
and a module that uses both wants them distinguishable.

### The raw `okStep` now unions its error types

Io `step` is raw `step` over `okStep`, the adapter that already writes the
`ok` / `error` branch — but `okStep` unified the two error types, which is
exactly what this layer must not do. Its type now quantifies the incoming error
on the second arrow (`<T, R, E>(f) => <F>(r) => …`), matching `okThen`, the
pure sibling its documentation already claimed. The change is a strict
generalization: every previous instantiation is `F = E`, so existing raw
consumers are unaffected.

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

## Leaving the layer

Not every consumer is ready to compose. Two named policies exist so that a site
which has not adopted the layer still has to *say* what it does with a failure
rather than discard it:

- `unwrapStep` (here) — panic on the error branch. It belongs where the caller
  genuinely has no answer: a build tool that cannot read its own sources, a
  reporter that cannot reach stdout. It is one greppable name rather than an
  `unwrap` buried in a continuation, so the sites that have not yet chosen a
  real policy are exactly the sites this name marks — and that is the worklist
  stage 4 starts from.
- `exitStep` / `errorMessage` (`../node/module.f.mjs`) — a `NodeProgram`'s
  exit-code policy: report the failure on `stderr` and exit `1`.

Neither is composition, and neither should grow: a consumer that can do
something better with a failure wants `catchStep` or `resultStep`.

## What is deliberately absent

- **No `notImplemented` value.** Nothing produces this error until stage 6,
  where a runner may omit a handler; until then it exists in the type model and
  runners stay total over their declared operation maps. The lifts do not
  produce it either — it arrives through an operation's own continuation, not
  from a program lifting it.
- **No Io `historyStep`.** It is *expected* — `fjs/cas`'s chains reach back to
  earlier values, so migrating them will need one — but the first consumer
  should shape it. Until then the raw `historyStep` still applies to any
  `IoEffect` whose links do not short-circuit.
- **No mirrored raw API.** Io variants of the other combinators (`foldStep`,
  `forEachStep`) arrive when real consumers require them, not speculatively.
  `mapStep` is here rather than deferred because without it every site
  converted in stage 4 would spell its trailing pure projection as a step,
  which [`../todo/map-step-combinator.md`](../todo/map-step-combinator.md)
  establishes is the wrong shape.
