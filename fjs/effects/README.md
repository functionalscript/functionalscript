# `Effect` — effects with an explicit error channel

`Effect<O, T, E>` ([`./types.ts`](./types.ts)) is a `Pure` thunk yielding
`Result<T, E>` or a `Do` node: the failure is part of the representation, not a
wrapper around it. One type, one module —
[`./module.f.mjs`](./module.f.mjs) holds the representation, its interpreters
and the combinators alike.

## Start here

An effect is a **description** of a program that talks to the outside world,
not the act of doing it. `readFile(path)` reads nothing: it is a value naming
the command `readFile`, its payload, and what to do with the answer. A
**runner** walks that value, performs each command it meets, and feeds the
answer back. The same program runs on Node, in a browser page, in the
SpiderMonkey shell, or against a mock in a proof, because only the runner
changes, provided that runner answers every operation the program uses: the
`ask` below has a handler only in its mock, and a host operation such as
`fetchText` only on the browser page (the runners table below names each
runner's operations).

Every answer is a [`Result`](../types/result/types.ts), so every effect has
an error channel, and the combinators below decide what happens to an error
without a `try`.

```js
/**
 * @import { DemoAsk as Ask, Effect } from './types.ts'
 * @import { MemOperationMap } from './mock/types.ts'
 */
import { catchStep, do_, pureOk, step } from './module.f.mjs'
import { run } from './mock/module.f.mjs'
import { error, ok } from '../types/result/module.f.js'

// An operation: a command name, called like a function, returning an Effect.
// Its type says what the command takes and answers; the name alone cannot.
/** @type {(question: string) => Effect<Ask, string, string>} */
const ask = do_('ask')

// A program: ask, then build a greeting from the answer.
const greet = step(ask('name?'), name => pureOk(`hello, ${name}`))

// A runner: here a mock whose state is a string and whose `ask` answers it.
/** @type {MemOperationMap<Ask, string>} */
const answers = { ask: () => state => [state, ok(state)] }
run(answers)('Ada')(greet)
// ['Ada', ['ok', 'hello, Ada']]

// The same program when `ask` fails: `step` skips its continuation.
/** @type {MemOperationMap<Ask, string>} */
const refuses = { ask: () => state => [state, error('no one')] }
run(refuses)('Ada')(greet)
// ['Ada', ['error', 'no one']]

// `catchStep` is the error path, as `step` is the success path.
run(refuses)('Ada')(catchStep(greet, e => pureOk(`hello, ${e}?`)))
// ['Ada', ['ok', 'hello, no one?']]
```

The demo on this directory's page runs a program like this one and prints
every operation the runner performed, so a failure that stops the program can
be watched happening.

### The combinators at a glance

|Combinator                       |Runs its continuation on        |Use it to                                          |
|---------------------------------|--------------------------------|---------------------------------------------------|
|`step(e, f)`                     |`ok`                            |sequence: the normal path                          |
|`mapStep(e, f)`                  |`ok`, with a plain function     |transform a value                                  |
|`catchStep(e, f)`                |`error`                         |recover, or replace an error                       |
|`orElse(forgiven, fallback)`     |a `catchStep` continuation      |forgive one class of error with a fallback value   |
|`resultStep(e, f)`               |either, with the whole `Result` |handle both branches explicitly                    |
|`attemptStep(e)`                 |none; answers the `Result`      |carry an outcome on as a value                     |
|`finallyStep(e, f)`              |either, keeping `e`'s answer    |clean up whatever happened                         |
|`foldStep`, `forEachStep`, `walkStep`|each item, stopping at an error|loop over a list without growing the stack       |
|`pureOk(v)`, `pureError(e)`      |                                |lift a value or an error into an effect            |
|`do_(command)`                   |                                |declare an operation                               |

### The modules

|Module                                  |Holds                                                                       |
|----------------------------------------|----------------------------------------------------------------------------|
|[`.`](./module.f.mjs)                   |the `Effect` type, the combinators above, and the matchers runners use      |
|[`common`](./common/README.md)          |operations any host can have: the console, `sandbox`, `catch`, `import`, `all`|
|[`node`](./node/README.md)              |Node operations (files, network, processes) and the `NodeProgram` type       |
|[`browser`](./browser/README.md)        |the browser page's operations: `fetchText`, `instantiate`, `jsHeapSize`      |
|[`mock`](./mock/README.md)              |synchronous runners for proofs: `run` and `partialRun`                      |
|[`memory`](./memory/README.md)          |typed key-value memory that persists across steps                           |
|[`list`](./list/README.md)              |`EffectList`, a list whose cells are produced by effects                    |
|[`schema`](./schema/README.md)          |RTTI schemas for the data-shaped operations                                 |
|[`spidermonkey`](./spidermonkey/module.mjs)|a partial Node host for the SpiderMonkey shell                            |

A program `fjs run` can start exports `main`, a `NodeProgram`
([`fjs/README.md`](../README.md#fjs-run--running-a-module-as-a-program)).

## Design record

The rest of this file is why the layer looks the way it does.

**It was two of each.** A payload-generic `RawEffect<O, T>` sat underneath, with
`Effect` an alias for `RawEffect<O, Result<T, E>>`, and the division was called
*composition* against *representation*. But an operation must return a `Result`,
so the payload a runner is generic over is always a `Result` — the second name
described no reachable case, while giving every combinator a `Result`-blind twin
that would run the next link after a failed one. Nothing "genuinely cannot
fail": an `EffectList` cell, a `Program`'s exit code, and an MCP tool result were each
named here as such, and all three carry channels now.

The combinators lived in an `io/` subdirectory while that lasted, because their
`step` collided by name with the `Result`-blind one. It was never an IO layer —
the name came from its being the *fallible* half — and with the twins gone there
was neither a collision nor a second module to justify.

The migration is recorded in
[`changelog/0.46.0.md`](../../changelog/0.46.0.md) and is
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

and one form of the last that takes no continuation: `attemptStep(e)` answers
`e`'s complete `Result` as its value and never fails, so the chain goes on
either way and a later step decides. Both paths, as a value.

The union rules follow `okThen` in
[`../types/result/module.f.js`](../types/result/module.f.js): error
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

`finallyStep` is `resultStep` plus one policy: run a cleanup whatever `e`
answered, hand the cleanup that answer, and keep it. It was declined while no
policy had repeated, on the principle that a derivable form earns a name by
being canonical vocabulary, and added once two consumers in `fjs/git/refstore`
— a lock held across a delete, and the directories made for one — had each
written it out by hand.

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
different ways, and it follows `okThen` (`fjs/types/result/module.f.js`), the
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
something better with a failure wants `catchStep` or `resultStep`. The commonest
such policy — forgive one class of error with a fallback, re-raise the rest — is
`orElse(forgiven, fallback)`, a `catchStep` continuation:
`catchStep(readFile(path), orElse(isNotFound, null))`.

## What is deliberately absent

This section used to list `notImplemented`, `historyStep`, `foldStep` and
`forEachStep` as things the layer had not needed yet, to be shaped by their
first consumer. All four exist now, and the list outlived them; what follows is
what is still absent, and why.

- **No `defer`.** `(() => Effect<O, T, E>) => Effect<O, T, E>` cannot be
  written: composition reads the `Pure` / `Do` tag before anything runs, and the
  union has no third case meaning "not yet decided". That is the representation,
  not a gap in this API — a caller who needs to name a composition without
  performing it keeps the ingredients and defers the step itself.
- **No second, `Result`-blind API.** There was one, and it is gone: see the top
  of this file for why one effect type means one set of combinators.
