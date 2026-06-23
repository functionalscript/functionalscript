# Automatic method binding

**Priority:** P3
**Status:** blocked

### Problem

Extracting a method reference in JavaScript loses `this`:

```ts
const m = [42].at
m(0) // TypeError or wrong result
```

FunctionalScript would benefit from automatically bound method references so extracted
methods behave like standalone functions.

### Trigger

Unblocked when ECMAScript introduces automatic binding for method references (e.g. via a
TC39 proposal reaching Stage 4), or when TypeScript provides a type-safe mechanism that
compiles away the binding overhead.
