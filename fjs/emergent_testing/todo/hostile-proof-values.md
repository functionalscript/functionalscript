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

**A thrown value that resists being read takes the run down.** `errorDetails`
reads `message` and `stack` and calls `String`, and a revoked `Proxy`, a
throwing accessor, or a `toString` that panics makes any of those throw. There
is no `try`/`catch` in FunctionalScript, so the shared core cannot guard it, and
the panic escapes the reporter — the run ends with no report at all rather than
one failed test. `fjs t` has always had this exposure (its reporter interpolates
the thrown value into a line); the browser runner used to defend against it in
impure code, and no longer does.

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

- Normalization could move behind `sandbox`: the operation already runs user
  code inside the host's `try`/`catch`, so it is the one place that can read a
  hostile value safely and hand back a `message`/`stack` pair that is already
  ordinary data. The shared `errorDetails` would then read a record rather than
  an arbitrary thrown value, and stay total.
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
