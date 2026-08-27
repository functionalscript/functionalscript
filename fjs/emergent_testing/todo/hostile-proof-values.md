## Hostile thrown values and cross-realm promises kill a run

**Priority:** P3
**Status:** open

### Problem

The browser runner (`../browser.mjs`) defends against two things `fjs t` does
not, and neither is reachable from ordinary FunctionalScript. That asymmetry is
the point of this file: when the two runners are unified
([share the browser and console proof runners](share-browser-console-runner.md)),
the shared core has to have *one* answer for each of them, decided rather than
inherited twice. `fjs t` is the reference, so the honest reading is that these
are gaps in `fjs t` which the browser happened to cover — and closing them in
the shared core is the way to keep that coverage instead of losing it to a port.

**A value that resists being read is not attributed to the test that produced
it.** Two functions in the shared core read user-supplied values without a
guard: the `collectTests` traversal enumerates a returned proof tree, and
`errorDetails` reads `message`/`stack` and calls `String` on a thrown value. A
throwing accessor, a revoked `Proxy`, or a hostile `toString` panics through
either, and there is no `try`/`catch` in FunctionalScript for the core to catch
it with. `fjs t` ends with a stack trace and no summary; the browser runner
today loses one test and carries on. Measured, with two modules in the tree and
only the first hostile: `fjs t` exits on an uncaught `hostile` and the second
module's passing proofs are never reported, while the browser records one failed
result and runs the rest. That asymmetry is now noted on `TestResult` in
`../types.ts`, because the type otherwise reads as though every runner tolerates
a non-leaf failure. What is missing from the core is
*attribution*: naming the leaf whose value could not be read, and continuing
with the rest. Whichever runner ends up on top of it, a page left in `running`
or a process that exits with no summary is the outcome an automated controller
cannot act on.

**A promise from another realm is not awaited.** `fjs t`'s `sandbox` asks `p
instanceof Promise`, which is false for a promise built in an iframe, a worker,
or a `node:vm` context. Such a value is walked as an ordinary proof tree
instead, so a *rejected* cross-realm promise is reported as a pass. The browser
runner carries `Symbol.species` machinery against this, which is a second answer
to the same question and is studied in
[imports, promises and realms](imports-promises-realms.md). The obvious repair —
brand-checking with `Object.prototype.toString` — is not one: the tag is
settable through `Symbol.toStringTag`, and an object carrying a `then` proof
would then be assimilated, breaking the rule that only actual promises are
asynchronous values.

### Design: a `catch` operation

Reading a user value belongs to the *operation*, not to the shared core, which
is what makes one fix serve every runner. Once the two runners share a core,
guarding the traversal once covers `fjs t` and the browser together — which is
an argument for doing this *with* the sharing change rather than before it.

**`sandbox` cannot hold it, and the reason is not the one it looks like.**
Timing is not the obstacle: the sub-tree walk in `runModule` happens *after* the
runner has resolved the leaf's promise, so `sandbox(() => collectTests(path,
false, r))` would run a pure synchronous thunk over an already-settled value.
The obstacle is the **virtual runner**. Its `sandbox` is a deliberate
pass-through — `f => state => [state, ok(f())]`, with the fixture returning the
`SandboxResult` it wants reported — because `../../effects/node/virtual` is
`.f.mjs` and FunctionalScript has no `try`/`catch` to implement a real one with.
Routing the traversal through `sandbox` would hand that handler a thunk
answering `_TestAndPath[]`, which it would cast to `SandboxResult` and every
fixture in `../proof.f.mjs` would break.

So add a second, honest operation beside it:

```ts
export type Catch = readonly['catch', <T>(f: () => T) => OpResult<Result<T, unknown>>]
```

"Run this pure thunk; a throw is the `error` branch." It carries no clock and no
fixture convention, so each runner implements it truthfully:

- the real Node runner, and whatever browser interpreter the sharing change
  produces: `tryCatch(f)`, one line each, from `types/result/module.mjs`.
- `effects/node/virtual/module.f.mjs`: `ok(ok(f()))` — a pure runner still
  cannot catch, and a hostile fixture still panics there, which is the same
  bargain `sandbox` already makes. Virtual proofs use benign fixtures.

`walk` then reads a sub-tree through `catch` and, on the `error` branch, reports
one failed result at that path instead of panicking — which is what restores
`exportedTreeThrows` / `returnedTreeThrows`, and gives `fjs t` a behaviour it
never had. `errorDetails` gets the same treatment at its one call site.

The work is roughly: the operation and its constructor beside `sandbox`, one
handler in each runner, the `CommandSet` entries, the `walk` change and its new
result shape, and the mock maps in the affected proofs.

**The brand check** for cross-realm promises is not designed here. It belongs
with the two mechanisms it keeps being confused with — a module namespace
adopting a `then`, and a proof tree refusing to — which are studied together in
[imports, promises and realms](imports-promises-realms.md).

### Tasks

- [ ] Add the `catch` operation, its constructor, and a handler in each of the
      Node, browser and virtual runners.
- [ ] Read sub-trees through it in `walk`, reporting an unreadable tree as one
      failed result at its path rather than a panic.
- [ ] Prove an unreadable exported tree and an unreadable returned tree, for
      `fjs t` as well as the browser — the browser has versions of these today
      and `fjs t` has none.
- [ ] Read a thrown value through it at `errorDetails`' call site.

### Constraints

- Whatever is added must apply to `fjs t` and to the browser runner alike. A
  defense in one runner only is the thing to avoid: it is how the two came to
  mean different things in the first place.
- An object carrying a `then` proof property must stay an ordinary proof tree.

### Related

- [Imports, promises and realms](imports-promises-realms.md) — where the
  cross-realm brand check is studied.
- [Browser testing](browser-testing.md)
- [Test-runner behavior](661-test-runner-behavior.md)
