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

### Preliminary design

Both belong to the *operation*, not to the shared core, which is what makes one
fix serve every runner:

- Reading a user value could move behind `sandbox`: the operation already runs
  user code inside the host's `try`/`catch`, so it is the one place that can
  enumerate a returned tree, or read a thrown value's `message`/`stack`, and
  hand back something that is already ordinary data. The shared `errorDetails`
  and `collectTests` would then read a record rather than an arbitrary value,
  and stay total — which also lets the failure be reported against the leaf that
  caused it instead of against the run.
- The brand check needs a test that a page cannot forge and that no proof tree
  can pass by accident. Candidates: `Promise.resolve(p) === p` on the value's
  own constructor, or asking each realm the runner knows about. Whatever is
  chosen must be one function both interpreters call, or the two drift again.

Neither is worth doing speculatively. Do the first when a real proof loses a
run to it, and the second when proofs genuinely execute in more than one realm —
which is the point [browser-testing](browser-testing.md) reaches with iframes or
workers.

### Constraints

- Whatever is added must apply to `fjs t` and to the browser runner alike;
  a defense in one runner only is what this repository just finished removing.
- An object carrying a `then` proof property must stay an ordinary proof tree.

### Related

- [Browser testing](browser-testing.md)
- [Test-runner behavior](661-test-runner-behavior.md)
