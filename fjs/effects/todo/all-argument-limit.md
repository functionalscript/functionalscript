## all-argument-limit. `all` cannot fan out more siblings than the engine allows arguments

**Priority:** P3
**Status:** open

### Problem

`All` is declared variadic — `readonly['all', <T, E>(...effects: Effect<never, T, E>[]) => …]` — so
every fan-out reaches it as a spread, and each one is a separate instance of the same
ceiling. Every site in the repository today:

| site | what it fans out |
|-|-|
| `emergent_testing/module.f.mjs` `registerModule` ×2, `registerModuleMap` | one module's sibling leaves, and the modules of a run, for the framework-registration path |
| `dev/module.f.mjs` ×2 | files to load, and their imports |

They fail independently: a suite of a hundred thousand *modules* breaks the outer spread
however few leaves each holds, and one module of a hundred thousand leaves breaks the inner
one however few modules there are. A fix has to be the operation's, not a site's.

The *proof-running* traversal used to hold two more rows — `walkEntries` and
`runModuleMap` — and functionalscript#1774 retired them by folding sequentially
instead of fanning out. That removed two instances of this ceiling as a side
effect of a change made for other reasons entirely; the registration path keeps
its fan-out deliberately, because an external framework owns that scheduling.

A spread is a call, and a call has an argument limit. Measured on node 22:

| siblings | result |
|-|-|
| 50,000 | ok |
| 100,000 | `RangeError: Maximum call stack size exceeded` |

The throw is in **building** the effect, before any interpreter sees it, so no runner can
recover from it and no `catch` operation is in the path. Today the paths that reach it are
`fjs t`'s module *loading* and the registration entry point, and both panic. (The reverted functionalscript#1759 briefly put the browser page on
it too, where the page's run-failure guard reported one `infrastructure-error` — the guard
working as intended, but not an answer; the current page takes the `Promise.all` path
below and never builds the effect.)

The ceiling applies **per fan-out**, and the registration path has two: one module with too
many sibling leaves breaks the inner spread, and a run with too many *modules* breaks the
outer one — the independence the table above states. Nothing in this repository is
close to either — the browser suite is 3,461 leaves across 138 modules, three orders of
magnitude under both — so this is a real ceiling rather than a live problem, and it is
recorded rather than fixed for that reason.

The browser runner is immune for a reason that has nothing to do with its batching:
`Promise.all(batch.map(…))` passes one iterable argument, so no spread exists there at any
batch size — the ceiling is the *variadic operation's*, not fan-out's in general. (An
earlier version of this paragraph credited `batchSize = 25` with staying under the limit;
that was a misattribution, corrected in the pitfall catalog in
[share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md).)
The reverted functionalscript#1759 routed the page through the shared traversal and so
briefly gave both runners the same ceiling; the sequential plan that replaced it removed
the traversal's fan-outs entirely (functionalscript#1774). What remains is the registration
path and `dev` — still the operation's problem, at fewer sites.

### Proposal

Make `all` take a list rather than an argument list:

```ts
export type All = readonly['all', <T, E>(effects: readonly Effect<never, T, E>[]) => OpResult<readonly Result<T, E>[]>]
```

Then `allOk(entries.map(one))` builds an array and hands it over, and no call in the path
grows with the suite. Every `all` handler changes shape — `effects/node`'s real and
virtual runners, the mock, and any fixture that supplies one — which is what makes this
its own step rather than a fix inside another change. Not a browser interpreter: the
proof traversal performs no `all` since functionalscript#1774, so no browser implements it.

The variadic spelling is nicer at the two-or-three-effect call sites that motivated it
(`both`, hand-written fan-outs in proofs), so a wrapper that keeps that shape over the
list-shaped operation is worth having in the same change. **Both callables get
unambiguous names, whichever branch is taken**: if the wrapper is kept it keeps
the published `all`/`allOk` names (that is what narrows the break, per the task
below) and the list-shaped operation is exported beside it under its own names
(say `allList`/`allOkList`); if the wrapper is dropped, the list shape takes
the old names. Every arbitrary-length fan-out — the sites in the
table, and combinators born after this issue
([allvoid-combinator](./allvoid-combinator.md),
[allreduce-combinator](./allreduce-combinator.md)) — calls the *list-shaped*
callable by whichever name this decision lands on, so those designs are
buildable under every permitted outcome. (The table's sites are the fixed set
that has to migrate; the combinators are the ones that must not be written
variadic in the first place.)

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
      table above with them. Future combinators scheduled after this issue are
      consumers too, born list-shaped rather than migrated:
      [allvoid-combinator](./allvoid-combinator.md) and
      [allreduce-combinator](./allreduce-combinator.md) both say so in their
      proposals — an arbitrary-length fan-out combinator with a spread in its
      body would rebuild this ceiling inside itself.
- [ ] Prove a fan-out above the current ceiling — the number itself is engine-specific, so
      the proof asserts that a large fan-out completes rather than asserting the ceiling.

### Related

- [share-browser-console-runner](../../emergent_testing/todo/share-browser-console-runner.md)
  — where the browser's accidental protection was removed, and why.
