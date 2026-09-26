## Array flat and join overflow the stack on deep nesting

**Priority:** P3
**Status:** open

### Problem

`Array::flat` (`vm/array/flat.rs`) and `Array::join` (`vm/array/join.rs`), and
through `join` the `String(a)` conversion of an array and the default
`toSorted`, which converts each element to a string, recurse once per level of
nesting. An array nested deeply enough — `[[[…]]]` built at run time with
`reduce`, say — then overflows the Rust stack in `a.flat(Infinity)`,
`String(a)` or `[a, 0].toSorted()`, and that is an abort, not a throw.

This is the same shape as
[`fjs/edag/todo/stack-safety.md`](../../fjs/edag/todo/stack-safety.md), one
layer down, and was deferred by name when the built-ins landed rather than
making their first implementation iterative.

A second cost of the same walk is time over **shared** arrays. `flat` counts
its result before building it, so a result past the length limit is refused
without allocating it, and an array whose elements are not flattened further
counts as its length in one step. Deeper than that, the count walks every
reference, so an array that shares one wide array at many depths — `2¹⁶`
references to `2¹⁶` elements, flattened with `Infinity` — takes `2³²` steps
before it is refused. That is slow, not wrong; a walk that remembers the
count of an array it has already seen would make it linear in the distinct
arrays.

### Proposal

Walk with an explicit stack of the arrays being flattened or joined, in place of
recursion, as `fjs/fsc/edag`'s `lower` does for operator chains.

### Tasks

- [ ] `flat` over an explicit stack, with a test nesting deeper than the
      default thread stack allows.
- [ ] `join` the same, with tests for `String(a)` and `[a, 0].toSorted()`
      over the same nesting.
- [ ] `flat`'s length count remembers each shared array's count, so a
      deeply shared result is refused in time linear in the distinct arrays.
