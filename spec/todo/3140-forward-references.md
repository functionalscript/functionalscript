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

### The self case: benefits and drawbacks

The `e` case is one rule: a `const` whose whole value is a function has the
name in that function's body, after the names the body binds itself. What
it buys is recursion as JavaScript writes it — `fact` calling `fact` —
where before a function reached itself only through a fixed-point
combinator or by being passed to itself, and the graph stays acyclic: the
read is the EDAG's `["self"]`, a node of the function, not an edge back to
its `const`. What it costs is one node kind the analysis, both
interpreters, the Rust printer and both writers must spell, and one
refusal: a body `const` of the name after the body has read the function
by it is `capture shadowed`, where JavaScript throws at run time, since the
read would have named the `const` before its initializer ran. The rule
stops at the function itself — `h` from `f` above stays refused — so it
decides nothing about how a later `const` or a mutually recursive group
will be resolved.

**Approval.** The self case was approved by @sergey-shandar on 2026-10-06,
and implemented as the pull requests #2629 (the EDAG node) and #2630 (the
language rule). The later-`const` and object-grouping cases above remain
proposals, with no approval recorded.

### Tasks

- [x] A function reading its own `const`'s name, `e` above: the function
      itself, [`["self"]`](../../todo/edag-stage1-discussion.md).
- [ ] Resolve the object grouping `x` above, the one read the example
      marks `ok` that is still `const not found`, and keep refusing the
      ones it marks `error` or `not ok`: `d` in its own initializer and
      `h` from `f`, a later `const`.

### Related

- [`body-const-forward-reference.md`](../../fjs/compiler/parser/todo/body-const-forward-reference.md)
  — the same gap inside a function body.
- [function-frame](./3111-function-frame.md) — mutually recursive functions
  and their frames.
