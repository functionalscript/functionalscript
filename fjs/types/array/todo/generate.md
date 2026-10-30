## Generate an array by index

**Priority:** P3
**Status:** wip

### Problem

The opcode lookup tables in
[`media/wasm/instruction`](../../../media/wasm/instruction/module.f.mjs)'s
`byCode` and the Huffman tables in
[`zlib/huffman`](../../../zlib/huffman/module.f.mjs)'s `code` use
`Array.from({ length: n }, (_, i) => ...)` to generate values by index.
The compiler refuses this use of `Array.from`, preventing these modules
from converting to `.f.js` even once their other refusals are removed.

### Proposal

Add `generate(n, f)` to [`types/array`](../module.f.mjs). For a finite
nonnegative integer `n`, return a dense array `[f(0), ..., f(n - 1)]`,
calling `f` once per index in ascending order. Zero returns an empty array
without calling `f`.

Build a dense placeholder array with
[`monoid.repeat`](../../../common/monoid/module.f.mjs), then use array
`.map` to compute each value. Reuse the array repetition implementation
rather than duplicating its monoid setup. Monoid doubling followed by map
requires linear array copying; mapping a lazy list and materializing it
with the current `List.toArray` requires balanced chunk merging instead.

Keep the helper usable from compiler-compatible modules. The existing
array and monoid modules depend on `types/list`, which is still refused;
consider extracting the independent repetition and generation operations
into compilable modules rather than pulling that dependency into callers.

The replacement rule applies when the original length is a finite
nonnegative integer. Other lengths need an explicit contract: existing
array repetition rounds positive fractions up, whereas `Array.from`
truncates them. This task does not require compiler recognition of
`Array.from`; that can later reuse the helper.

### Tasks

- [ ] Specify the length contract outside finite nonnegative integers and
      the public type signature for `generate(n, f)`.
- [ ] Implement the helper using monoid repetition and array map, making
      its runtime dependency closure compiler-compatible.
- [ ] Add proofs covering empty and nonempty output, index order, callback
      invocation counts, stored `undefined` values, callback failure, and
      the chosen length contract.
- [ ] Add a rule to [`doc/CONVERTING.md`](../../../../doc/CONVERTING.md)
      explaining how to avoid `Array.from({ length: n }, (_, i) => f(i))`
      with `generate(n, f)`, including the helper import and the length
      conditions under which the rewrite preserves behavior.
- [ ] Replace the applicable `Array.from` calls in `byCode` and Huffman's
      `code`; check each complete module before renaming it to `.f.js`.

### Related

- [Leaf migration audit](../../../../todo/fjs-nanvm-integration.md#current-leaf-migration-fixed-point)
  — other refusals can remain after replacing `Array.from`.
