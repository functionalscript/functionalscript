## Hostile thrown values and cross-realm promises kill a run

**Priority:** P3
**Status:** open

### Problem

The browser runner (`../browser/module.mjs`) defends against something `fjs t`
does not, and it is not reachable from ordinary FunctionalScript. That asymmetry is
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
today loses one test and carries on.

**The `collectTests` half is closed** (functionalscript#1830): both the
returned sub-tree and the module's own export are read under `catch`, in the
shared traversal, so both runners answer one unreadable value with one failed
record and keep going. What is left of this issue is `errorDetails` — reading
the *thrown* value, which each host still does its own way — and the
cross-realm promise below. Measured, with two modules in the tree and
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
instead, so a *rejected* cross-realm promise is reported as a pass. **This half
is no longer an asymmetry**: the browser carried `Symbol.species` machinery
against it and no longer does — since functionalscript#1742 both runners ask the
same question in `effects/common`'s `sandbox`, so the exposure is shared and
tracked in [imports, promises and realms](imports-promises-realms.md) rather
than covered on one side. It is kept here because closing it is still owed, and
because the shared answer is the one to close. The obvious repair —
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
one failed result at that path instead of panicking — which is what preserves
the browser's `exportedTreeThrows` / `returnedTreeThrows` (`../browser/proof.mjs`)
once the traversal is shared, and gives `fjs t` a behaviour it never had. The
`fjs t` proof carries the same name deliberately, in `../catch.proof.mjs`: one
behaviour, named once, proven per runner. `errorDetails` gets the same treatment at its one call site.

The work is roughly: the operation and its constructor beside `sandbox`, one
handler in each runner, the `CommandSet` entries, the `walk` change and its new
result shape, and the mock maps in the affected proofs.

**The brand check** for cross-realm promises is not designed here. It belongs
with the two mechanisms it keeps being confused with — a module namespace
adopting a `then`, and a proof tree refusing to — which are studied together in
[imports, promises and realms](imports-promises-realms.md).

### Tasks

- [x] Add the `catch` operation, its constructor, and a handler in the Node and
      virtual runners. The browser handler waits for the browser interpreter,
      which is where a browser runner will first dispatch one.
- [x] Read the *returned* sub-tree through it in `walk`, reporting an unreadable
      tree as that leaf's failure rather than a panic.
- [x] Read the **exported** tree through it too, in `runModule`. The report
      shape this was waiting on turned out to need no new vocabulary: the
      module is named the way a leaf is, `import("./a.f.mjs").proof()` with an
      empty path, and travels through the same `start` and `result` events with
      the thrown value in its `SandboxResult` — so a host describes it exactly
      as it describes a leaf's, and a filter that matches leaf names matches
      this too. Measured before the change, two modules with only the first
      hostile: `fjs t` exited on the throw with no summary and the second
      module's passing proofs were never reported. After: one failed record,
      the second module runs, `pass: 2, fail: 1`, exit 1.
      Pinned by `moduleExportThrows` and `moduleFailureThatCannotBeReported` in
      `../catch.proof.mjs`, both mutation-checked.
- [x] Prove an unreadable returned tree for `fjs t` — `returnedTreeThrows` in
      `../catch.proof.mjs`, beside `returnedTreeIsStillWalked`. The file is
      `.mjs` for the reason this whole issue rests on: a runner that reports a
      throw needs a real `try` to write, so it drives `runModuleMap` through a
      mock rather than through the virtual runner, and a mock like that cannot
      be written in `.f.mjs`.
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
