## Array flat and join overflow the stack on deep nesting

**Priority:** P3
**Status:** open

### Problem

`Array::flat` (`vm/array/flat.rs`) and `Array::join` (`vm/array/join.rs`), and
through `join` the `String(a)` conversion of an array, recurse once per level
of nesting. An array nested deeply enough — `[[[…]]]` built at run time with
`reduce`, say — then overflows the Rust stack in `a.flat(Infinity)` or
`String(a)`, and that is an abort, not a throw.

This is the same shape as
[`fjs/edag/todo/stack-safety.md`](../../fjs/edag/todo/stack-safety.md), one
layer down, and was deferred by name when the built-ins landed rather than
making their first implementation iterative.

### Proposal

Walk with an explicit stack of the arrays being flattened or joined, in place of
recursion, as `fjs/fsc/edag`'s `lower` does for operator chains.

### Tasks

- [ ] `flat` over an explicit stack, with a test nesting deeper than the
      default thread stack allows.
- [ ] `join` the same.
