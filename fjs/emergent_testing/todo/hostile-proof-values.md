## Hostile thrown values and cross-realm promises kill a run

**Priority:** P3
**Status:** open

### Problem

Both runners now share one core (`../module.f.mjs`), so they also share two
weaknesses the core cannot fix on its own. Neither is reachable from ordinary
FunctionalScript, and both were reachable — and covered — by the browser runner
before it and `fjs t` were unified; unifying adopted `fjs t`'s semantics
deliberately, so this file is where the difference went rather than being
silently dropped.

**A value that resists being read is not attributed to the test that produced
it.** Two shared functions read user-supplied values without a guard: the
`collectTests` traversal enumerates a returned proof tree, and `errorDetails`
reads `message`/`stack` and calls `String` on a thrown value. A throwing
accessor, a revoked `Proxy`, or a hostile `toString` panics through either, and
there is no `try`/`catch` in FunctionalScript for the core to catch it with.

The browser adapter turns that panic into an `infrastructure-error` report
rather than leaving the page in `running`, so a run always terminates — but the
whole run is lost where the deleted runner lost one test, and `fjs t` still ends
with a stack trace and no summary. What is missing is *attribution*: naming the
leaf whose value could not be read, and continuing with the rest.

**A promise from another realm is not awaited.** Both `sandbox` interpreters ask
`p instanceof Promise`, which is false for a promise built in an iframe, a
worker, or a `node:vm` context. Such a value is walked as an ordinary proof tree
instead, so a *rejected* cross-realm promise is reported as a pass. The obvious
repair — brand-checking with `Object.prototype.toString` — is not one: the tag
is settable through `Symbol.toStringTag`, and an object carrying a `then` proof
would then be assimilated, breaking the rule that only actual promises are
asynchronous values.

### Design: a `catch` operation

Reading a user value belongs to the *operation*, not to the shared core, which
is what makes one fix serve every runner. Since the two runners are now one,
guarding the traversal once covers `fjs t` and the browser together.

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

- `effects/node/module.mjs` and `effects/browser/module.mjs`: `tryCatch(f)`, one
  line each, from `types/result/module.mjs`.
- `effects/node/virtual/module.f.mjs`: `ok(ok(f()))` — a pure runner still
  cannot catch, and a hostile fixture still panics there, which is the same
  bargain `sandbox` already makes. Virtual proofs use benign fixtures.

`walk` then reads a sub-tree through `catch` and, on the `error` branch, reports
one failed result at that path instead of panicking — which is what restores
`exportedTreeThrows` / `returnedTreeThrows`, and gives `fjs t` a behaviour it
never had. `errorDetails` gets the same treatment at its one call site.

The work is roughly: the operation and its constructor in `effects/common`, one
handler in each of the three runners, the `CommandSet` entries, the `walk`
change and its new result shape, and the mock maps in
`effects/common/proof.f.mjs` and `emergent_testing/browser/proof.f.mjs`.

**The brand check** for cross-realm promises is not designed here. It belongs
with the two mechanisms it keeps being confused with — a module namespace
adopting a `then`, and a proof tree refusing to — which are studied together in
[imports, promises and realms](imports-promises-realms.md).

### Tasks

- [ ] Add the `catch` operation, its constructor, and a handler in each of the
      Node, browser and virtual runners.
- [ ] Read sub-trees through it in `walk`, reporting an unreadable tree as one
      failed result at its path rather than a panic.
- [ ] Restore `exportedTreeThrows` and `returnedTreeThrows`, and add the `fjs t`
      counterparts the browser-only versions never had.
- [ ] Read a thrown value through it at `errorDetails`' call site.

### Constraints

- Whatever is added must apply to `fjs t` and to the browser runner alike;
  a defense in one runner only is what this repository just finished removing.
- An object carrying a `then` proof property must stay an ordinary proof tree.

### Related

- [Imports, promises and realms](imports-promises-realms.md) — where the
  cross-realm brand check is studied.
- [Browser testing](browser-testing.md)
- [Test-runner behavior](661-test-runner-behavior.md)
