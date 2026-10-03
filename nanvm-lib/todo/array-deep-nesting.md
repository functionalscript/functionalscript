## Array flat, join and to_json overflow the stack on deep nesting

**Priority:** P3
**Status:** open

**Partial:** the traversal in `flat`, `join` (used by `String(a)` and the default
`toSorted`) and `to_json` now uses a heap stack. End-to-end deep-value support
remains unfinished: `Naive` still destroys nested containers recursively.
The shared-array count of `flat`, below, and recursive `Debug` also remain open.

### Remaining destruction limit

A sole-owned deeply nested `Naive` value can still abort when its last reference
is released. `to_json` can do this when it pops its final frame or returns an
error; the consuming wrappers for `flat`, `join`, `String(a)` and `toSorted` can
do it when they release the receiver. Dropping the value after a borrowed read
has the same limit.

On a 256 KiB thread stack, construct 100,000 single-element arrays around `null`
and call `arrays.to_json()` without retaining a clone: recursive destruction
can overflow before the result returns. A sole-owned 10,000-level array passed
to `a.to_string()` reproduces the same failure. Nested objects and an
`undefined` leaf returning `JsonError::Undefined` also need consuming-call
coverage when destruction is made stack-safe.

The deep-read tests deliberately leak a root clone **before** reading or
asserting, so a panic reports the original failure instead of recursively
dropping the root during unwinding. They prove traversal with a retained root,
not sole-owned consumption or safe cleanup.

Keep `naive` as the simple reference implementation. Stack-safe destruction is
deferred to a separate VM; these traversal changes do not depend on #2520's
proposed destructor changes.

### Original traversal problem

`Array::flat` (`vm/array/flat.rs`) and `Array::join` (`vm/array/join.rs`), and
through `join` the `String(a)` conversion of an array and the default
`toSorted`, which converts each element to a string, used to recurse once per
level of nesting. An array nested deeply enough — `[[[…]]]` built at run time
with `reduce`, say — then overflowed the Rust stack in `a.flat(Infinity)`,
`String(a)` or `[a, 0].toSorted()`: an abort, not a throw.

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

`Any::to_json` recursed the same way (`ToJson::array`, `ToJson::object`) and had
a cost of its own: each level rendered its children into a `String` of its own and
copied it into its parent's, so a value `n` levels deep copied its text `n` times,
quadratic in the depth, before it overflowed.

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
explicit traversal stack has no such recursion limit, but does not change the
VM's destruction limit above.

**`join` and `String(a)`.** An array cannot own a `toString`, so converting a
nested array is always `Array.prototype.join(",")`, and the nesting can be walked
without the visitor: a frame per array holding its pieces, an element that is an
array pushing a frame with separator `","`, and any other element converted by
`to_string` as now. An object's own `toString` that calls back into an array
conversion is a function call, not nesting, and is bounded by the call depth.

`Debug` is left out: it is a diagnostic, and its recursion costs far less a
level.

### Tasks

- [x] `flat` traversal over an explicit stack, with a retained-root test nesting
      deeper than the default thread stack allows.
- [x] `join` traversal the same, with retained-root tests for `join` and
      `String(a)` over the same nesting.
- [ ] `flat`'s length count remembers each shared array's count, so a
      deeply shared result is refused in time linear in the distinct arrays.
- [x] `to_json` traversal over an explicit stack writing into one buffer, with
      retained-root tests at a depth far past the stack and a check that the
      text is the one the recursive version produced.
- [ ] Support sole-owned deep values in a separate VM, including successful
      consuming reads, early errors, and ordinary destruction. Test without
      leaked roots; `Naive` retains the documented limit above.
- [ ] Address recursive `Debug` for deeply nested values.
