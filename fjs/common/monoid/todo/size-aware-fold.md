## size-aware-fold. Balance `fold` by the size of its values, not their count

**Priority:** P3
**Status:** open

### Problem

`fold`, `foldAbsorbing` and `step` (`fjs/common/monoid/module.f.mjs`) balance
their merges like a binary counter over the number of elements seen: `step`
seeds each element as a run of size one, and `push` carries while the top run
has the same size, doubling it. The value itself is never measured.

That is the right balance when every element weighs the same. It is the wrong
one for the monoids the module exists for — array, string and `bit_vec`
concatenation, where a merge costs the length of its operands — as soon as the
elements differ in length. One long array followed by many single items is the
case that shows it: the long array sits in the run of size one, the first
single item merges with it, and every later carry that reaches that run copies
the long array again, `log2(n)` times for `n` items, when it needed copying
once. `bit_vec`'s `unpackListToVec` has the same shape with one long vector
among short ones.

`fjs/types/list/alt`'s `toArray` keeps its own stack for this reason: its
`push` merges a chunk with the top only while the top is no longer than the
chunk, so the arrays shorten strictly towards the top and a long array is
copied once, at the final join. It is the same algorithm as `step` with the
array's length in place of the run count, and a second copy of the module's
idea ([AGENTS.md §1](../../../../AGENTS.md#1-workflow): reuse, don't copy).

### Proposal

A weighted fold next to the counted one: the caller supplies how heavy a
value is, `(value: T) => number` or `bigint`, and the stack merges a run
while the top's weight is no greater than the incoming one, keeping weights
strictly increasing from top to bottom. The order of operands and the identity
seeding stay `fold`'s; an absorbing variant follows the same way. The counted
`step` is the weighted one with a weight of one per element, so one may be
written in terms of the other.

Then `list/alt`'s `toArray` folds with it and drops its stack, and `bit_vec`'s
concatenation gets the same bound. `set` keeps the counted `step`: its runs are
disjoint `Set`s, so count and weight already agree.

### Tasks

- [ ] Decide the weight's type (`number` or `bigint`) and the export's shape
- [ ] Implement the weighted stack with its proof, including a long value among
      many short ones
- [ ] Rebuild `list/alt`'s `toArray` on it and delete its private stack
- [ ] Consider `bit_vec`'s `unpackListToVec`

### Related

- [`fjs/types/list/alt/module.f.mjs`](../../../types/list/alt/module.f.mjs) —
  the length-aware stack this would replace
- [`fjs/types/set/module.f.mjs`](../../../types/set/module.f.mjs) — keeps the
  counted `step`
