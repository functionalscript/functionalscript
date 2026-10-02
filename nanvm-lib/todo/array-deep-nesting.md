## Array flat, join and to_json overflow the stack on deep nesting

**Priority:** P3
**Status:** open

**Done:** `flat`, `join` (so `String(a)` and the default `toSorted`) and `to_json`
walk a heap stack and take a value of any depth. What is left is the shared-array
count of `flat`, below, and `Debug`, which stays recursive.

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

`Any::to_json` recurses the same way (`ToJson::array`, `ToJson::object`) and has
a cost of its own: each level renders its children into a `String` of its own and
copies it into its parent's, so a value `n` levels deep copies its text `n` times,
quadratic in the depth, before it overflows.

### Proposal

Walk with an explicit stack of the arrays being flattened or joined, in place of
recursion, as `fjs/compiler/edag`'s `lower` does for operator chains. The three
walks (`flat`, `join` and `to_json`) are the same task on three accumulators.

**Why not a depth limit that throws.** JavaScript engines throw a `RangeError`
at a depth in the thousands, so a limit looks like the natural answer. The
stack a level costs rules it out here. On a 256 KiB stack the deepest value
each read survives is:

| operation | release build | debug build |
|---|---|---|
| `String(a)`, `join` | 109 levels | 30 levels |
| `flat(Infinity)` | 499 | 150 |
| `to_json` | 944 | 318 |
| `{:?}` (`Debug`) | 2,293 | 638 |

The shallowest, `String(a)`, costs about 2.4 KiB a level in a release build and
about 8.7 KiB in a debug build, because the conversion goes through the
`Dispatch` visitor and `Result<Any, Any>` frames. A limit safe on a 2 MiB test
thread in a debug build would be a few hundred levels, and a program that nests
an array a thousand deep and prints it would throw where JavaScript answers. An
explicit stack has no such limit and no per-level stack.

**`join` and `String(a)`.** An array cannot own a `toString`, so converting a
nested array is always `Array.prototype.join(",")`, and the nesting can be walked
without the visitor: a frame per array holding its pieces, an element that is an
array pushing a frame with separator `","`, and any other element converted by
`to_string` as now. An object's own `toString` that calls back into an array
conversion is a function call, not nesting, and is bounded by the call depth.

`Debug` is left out: it is a diagnostic, and its recursion costs far less a
level.

### Tasks

- [x] `flat` over an explicit stack, with a test nesting deeper than the
      default thread stack allows.
- [x] `join` the same, with tests for `String(a)` and `[a, 0].toSorted()`
      over the same nesting.
- [ ] `flat`'s length count remembers each shared array's count, so a
      deeply shared result is refused in time linear in the distinct arrays.
- [x] `to_json` over an explicit stack writing into one buffer, with tests
      through `to_json` at a depth far past the stack and a check that the
      text is the one the recursive version produced.
