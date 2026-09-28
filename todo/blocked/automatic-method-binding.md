## Automatic method binding

**Priority:** P3
**Status:** blocked

### Problem

Extracting a method reference in JavaScript loses `this`:

```ts
const m = [42].at
m(0) // TypeError or wrong result
```

### Trigger

TypeScript ships the check proposed in
[144](../144-ts-prototype-functions.md): it tracks whether a function needs
`this` and rejects a detached call such as `m(0)` above, so the extraction
becomes a compilation error rather than a runtime one.

ECMAScript itself is unlikely ever to bind methods automatically, for
compatibility reasons. A [pipeline operator](./pipeline-operator.md) can
provide a good alternative for chaining methods.

### Related

- [144-ts-prototype-functions](../144-ts-prototype-functions.md) — the
  TypeScript proposal this waits on.
- [new-pl.md § Automatic Binding](../new-pl.md#automatic-binding) — a from-scratch PL isn't bound by ECMAScript's compatibility constraint and can adopt this behavior directly.
