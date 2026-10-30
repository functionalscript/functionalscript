## size-aware-fold. Fold the concatenations by weight

**Priority:** P3
**Status:** open

### Problem

`fold` (`fjs/common/monoid/module.f.mjs`) balances its merges by how many
elements each run holds. That is the right balance when every element weighs
the same, and the wrong one for the monoids the module exists for — array,
string and `bit_vec` concatenation, where a merge costs the length of its
operands — as soon as the elements differ in length: one long array among
many short ones is copied again at every carry that reaches its run,
`log2(n)` times for `n` items, when once would do. The copies are the smaller
cost; each is a fresh allocation the size of the result.

`fold` balances by the monoid's `weight` instead, read from each value, with
the rule `step`'s doc comment states. One concatenation still balances on a
stack of its own:

- `fjs/types/list/alt`'s `toArray` keeps a stack of its own that merges a
  chunk with the top only while the top is no longer than the chunk. It
  copies a long array once, but arrays of strictly decreasing length never
  merge on it, so that input costs it the square root of the total length
  times the total, where `fold` stays logarithmic.

### Tasks

- [x] Decide the weight's type (`number`) and the export's shape (`foldBy`,
      `foldAbsorbingBy`, `stepBy`, each `weight` first)
- [x] Implement the weighted stack with its proof, including a long value among
      many short ones and strictly decreasing lengths
- [x] Move `weight` onto `Monoid`, drop `foldBy`, `foldAbsorbingBy` and
      `stepBy`, and give every monoid in the tree its weight
- [x] Fold `bit_vec`'s `unpackListToVec` by the vector's length
- [x] Weigh the value rather than the run: a weight read from the value is
      all the balance needs, `step` merges only the runs already on the stack
      and never the value that arrives, and the stack is folded by the same
      rule at the end, so a long value is never copied on arrival and the
      runs of one weight stay a binary counter
- [ ] Rebuild `list/alt`'s `toArray` on `fold`, feeding it the list's arrays
      whole, and delete its private stack

### Related

- [`fjs/types/list/alt/module.f.mjs`](../../../types/list/alt/module.f.mjs) —
  the length-aware stack `fold` replaces
- [`fjs/types/set/module.f.mjs`](../../../types/set/module.f.mjs) — keeps
  `step`: its runs are disjoint `Set`s, so count and weight agree
