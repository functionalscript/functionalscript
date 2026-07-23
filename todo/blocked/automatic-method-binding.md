# Automatic method binding

**Priority:** P3
**Status:** blocked

### Problem

Extracting a method reference in JavaScript loses `this`:

```ts
const m = [42].at
m(0) // TypeError or wrong result
```

### Trigger

Most likely, ECMAScript would never address this issue for a compatibility reason. A [pipeline operator](./pipeline-operator.md) can provide a good alternative for chaining methods.

When TypeScript provides a type-definition for prototype methods which will trigger a compilation error on previous code. `at` should be defined not as a method of `Array` but as a method of `Array.prototype`, or something like that.

### Related

- [new-pl.md § Automatic Binding](../new-pl.md#automatic-binding) — a from-scratch PL isn't bound by ECMAScript's compatibility constraint and can adopt this behavior directly.
