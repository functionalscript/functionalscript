## Forward references

**Priority:** P3
**Status:** open

### Problem

A module `const` cannot read a `const` declared after it: the compiler answers
`const not found`, so a function cannot call a later function
([shared values](../README.md#shared-values-constants)). A function calling
itself is resolved, the `e` case below: a `const` whose whole value is a
function has the name in that function's body, the EDAG's `["self"]`. Only
forward objects should be visible. Example:

```js
const a = () => 5;
const b = () => a() + 7; // ok
const c = b();           // ok
const d = d();           // error!
const e = () => e();     // ok: landed, `e` is the function's own `["self"]`
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

- [x] A function reading its own `const`'s name, `e` above: the function
      itself, [`["self"]`](../../todo/edag-stage1-discussion.md).
- [ ] Resolve the remaining reads the example marks `ok` — a later function,
      `h` from `f`, and the object grouping `x` — and refuse the ones it
      marks `error` or `not ok`.

### Related

- [`body-const-forward-reference.md`](../../fjs/compiler/parser/todo/body-const-forward-reference.md)
  — the same gap inside a function body.
- [function-frame](./3111-function-frame.md) — mutually recursive functions
  and their frames.
