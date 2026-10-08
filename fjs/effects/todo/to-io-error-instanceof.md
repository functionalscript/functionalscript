## to-io-error-instanceof. `toIoError` tests `instanceof Error`, which the language refuses

**Priority:** P3
**Status:** open

### Problem

`toIoError` in [`../module.f.mjs`](../module.f.mjs) reads a thrown value's
message with `e instanceof Error ? e.message : String(e)`. The module is
FunctionalScript, and the compiler admits `instanceof` with `Array` on the
right only ([`instanceof`](../../../spec/README.md#instanceof)),
so this line is a refusal the module meets whatever else lands.

`instanceof Error` is not going to be admitted for it. The language builds
no `Error`, so the test is `false` of every value FunctionalScript makes;
the `Error` here is one the host threw, read at a runner's `catch`. The
test also misses an `Error` from another realm, an iframe or a worker,
whose `message` is exactly what the function exists to keep.

### Proposal

Read the field instead of the prototype, as
[`fjs/emergent_testing/browser`](../../emergent_testing/browser/module.f.mjs)
already does for the same cross-realm reason: a value carrying a string
`message` gives that, and every other value its `String` form. The function
already asks `typeof e !== 'object' || e === null || !('code' in e)` for the
code, so the message takes the same shape of question.
