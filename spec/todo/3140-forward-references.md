## Forward references

**Priority:** P3
**Status:** open

### Problem

A module `const` cannot read a `const` declared after it: the compiler answers
`const not found`, so a function cannot call itself or a later function
([shared values](../README.md#shared-values-constants)). Only forward objects
should be visible. Example:

```js
const a = () => 5;
const b = () => a() + 7; // ok
const c = b();           // ok
const d = d();           // error!
const e = () => e();     // ok
// two mutually recursive functions:
const f = () => h();     // not ok
const h = () => f();     // ok
// solution via object grouping:
const x = {
    a: () => x.b(),      // ok
    b: () => x.a(),      // ok
    c: () => x.rrrr(),   // ok
};
```

### Tasks

- [ ] Resolve the reads the example marks `ok` and refuse the ones it marks
      `error` or `not ok`.

### Related

- [`body-const-forward-reference.md`](../../fjs/fsc/parser/todo/body-const-forward-reference.md)
  — the same gap inside a function body.
- [function-frame](./3111-function-frame.md) — mutually recursive functions
  and their frames.
