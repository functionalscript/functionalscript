## `dispatch` looks up handlers with bracket indexing

**Priority:** P2
**Status:** open

### Problem

`module.f.mjs:103-107`:

```js
/** @type {Handler | undefined} */
const handler = handlers[method]
if (handler === undefined) {
    return errorResponseOf(id)(methodNotFound)
}
```

`method` is untrusted wire data and `handlers` is an ordinary object, so an
inherited `Object.prototype` name resolves to a callable. Reproduced against
the real module:

```
{method: 'constructor'} → TypeError thrown out of dispatch
{method: 'toString'}    → {"jsonrpc":"2.0","error":"o","id":1}
```

(the second destructures `"[object Undefined]"` character-wise). A pure
dispatcher documented to answer `-32601` instead throws out of the caller or
emits a schema-violating response.

Every other dispatch site in the repo already uses `at` from
`fjs/types/object`, each with a comment naming this exact hazard —
`match` (`fjs/effects/module.f.mjs:344-355`), `cli/dispatch`
(`fjs/cli/module.f.mjs:36-45`), `addRevisionToCache`
(`fjs/cas/evo/module.f.mjs:143-149`). `json_rpc` is the one that reads raw.

### Proposal

`const handler = at(method)(handlers)`, testing `=== null`. The hand-written
`/** @type {Handler | undefined} */` annotation (needed only because the
index-signature type lies) goes away too. Add `throw`-free proofs for
`constructor` / `toString` methods answering `methodNotFound`.

### Tasks

- [ ] Switch the lookup to `at` and drop the annotation
- [ ] Add proofs for prototype-name methods

### Related

- [effectful-dispatch-skeleton](effectful-dispatch-skeleton.md) — quotes
  these lines but leaves the lookup as-is; whichever lands first should carry
  the fix
