## all-argument-limit. `all` cannot fan out more siblings than the engine allows arguments

**Priority:** P3
**Status:** open

### Problem

`All` is declared variadic — `readonly['all', <T, E>(...effects: Effect<never, T, E>[]) => …]` — so
every fan-out reaches it as a spread, and each one is a separate instance of the same
ceiling. Every site in the repository today:

| site | what it fans out |
|-|-|
| `emergent_testing/module.f.mjs` `walkEntries` | one module's sibling leaves |
| `emergent_testing/module.f.mjs` `runModuleMap` | the modules of a run |
| `emergent_testing/module.f.mjs` `registerModule` ×2, `registerModuleMap` | the same two, for the framework-registration path |
| `dev/module.f.mjs` ×2 | files to load, and their imports |

They fail independently: a suite of a hundred thousand *modules* breaks the outer spread
however few leaves each holds, and one module of a hundred thousand leaves breaks the inner
one however few modules there are. A fix has to be the operation's, not a site's.

A spread is a call, and a call has an argument limit. Measured on node 22:

| siblings | result |
|-|-|
| 50,000 | ok |
| 100,000 | `RangeError: Maximum call stack size exceeded` |

The throw is in **building** the effect, before any interpreter sees it, so no runner can
recover from it and no `catch` operation is in the path. `fjs t` panics; the browser page
reports one `infrastructure-error` because it guards the run's own failure, which is the
guard working as intended but not an answer.

The ceiling applies **per fan-out**, and a run has two: one module with too many sibling
leaves breaks the inner spread, and a run with too many *modules* breaks the outer one in
`runModuleMap` — the independence the table above states. Nothing in this repository is
close to either — the browser suite is 3,461 leaves across 138 modules, three orders of
magnitude under both — so this is a real ceiling rather than a live problem, and it is
recorded rather than fixed for that reason.

The browser runner avoids it accidentally: it fans out in batches of 25 through
`Promise.all`, so it never spreads more than 25 arguments — a protection nobody asked for
or noticed, one of three unnamed jobs that constant turned out to do (see the pitfall
catalog in
[share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)).
The reverted functionalscript#1759 routed the page through the shared traversal and so
briefly gave both runners the same ceiling; the sequential plan that replaced it removes
the traversal's fan-outs entirely, which retires the `walkEntries` and `runModuleMap` rows
above. What remains then is the registration path and `dev` — still the operation's
problem, at fewer sites.

### Proposal

Make `all` take a list rather than an argument list:

```ts
export type All = readonly['all', <T, E>(effects: readonly Effect<never, T, E>[]) => OpResult<readonly Result<T, E>[]>]
```

Then `allOk(entries.map(one))` builds an array and hands it over, and no call in the path
grows with the suite. Every `all` handler changes shape — `effects/node`'s real and
virtual runners, the mock, and any fixture that supplies one — which is what makes this
its own step rather than a fix inside another change. Not a browser interpreter: under
the sequential plan the traversal performs no `all`, so no browser implements it.

The variadic spelling is nicer at the two-or-three-effect call sites that motivated it
(`both`, hand-written fan-outs in proofs), so a wrapper that keeps that shape over the
list-shaped operation is worth having in the same change.

### Alternatives considered

- **Chunk the traversal.** Fan out in groups below the limit. This puts a constant back
  into the shared walk, which is the mistake
  [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
  spends several pages on, and it changes the concurrency of every run to work around an
  argument-passing detail. No.
- **Leave it.** Defensible today, and what this issue does for now. It stops being
  defensible the first time a generated suite puts tens of thousands of leaves in one
  module.

### Tasks

- [ ] Decide the list-shaped `All` signature and whether a variadic wrapper stays.
      **Either way this is breaking, and the entry must say so.** Changing the
      *operation* breaks every `all` handler however it is spelled at call
      sites; dropping the wrapper additionally changes the published
      `all`/`allOk` call shape, which reaches every fixed-arity caller
      (`both`, hand-written fan-outs in proofs) and any external importer —
      so the PR migrates every in-repo caller in the same change and carries
      a `**BREAKING CHANGES:**` changelog entry naming what moved. Keeping
      the wrapper narrows the break to the handlers, which is the argument
      for keeping it.
- [ ] Move every interpreter and fixture to it in one change, and every spread site in the
      table above with them.
- [ ] Prove a fan-out above the current ceiling — the number itself is engine-specific, so
      the proof asserts that a large fan-out completes rather than asserting the ceiling.

### Related

- [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
  — where the browser's accidental protection was removed, and why.
