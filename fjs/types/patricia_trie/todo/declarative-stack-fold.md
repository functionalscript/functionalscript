## Fold the trie stack declaratively

**Priority:** P3
**Status:** open

### Problem

`module.f.mjs:14-36` has three deviations in 22 lines:

- `stack[stack.length - 1]`, `stack[stack.length - 2]`, and
  `stack.slice(0, -2)` re-implement `last` and `splitLast` from the sibling
  `fjs/types/array` (§6.3 also prefers destructuring over indexed access).
- `end` is a right fold over the stack written as a manual descending index
  loop with `let h` and a mutating destructuring assignment
  (`[h, storage] = create(lHash, h, storage)`) — squarely §5.5 and §6.1.
- `end`'s `stack.length === 0` early return plus "seed from the last element"
  is the standard no-seed reduce; expressed over `splitLast(stack)` the empty
  case is the `null` branch and the guard disappears.

### Proposal

Import `last`/`splitLast` from `fjs/types/array`; express `end` as a
`reduceRight` (or a `list.fold` over the reversed stack) threading
`[h, storage]` as the accumulator. `push`'s loop is a genuine
carry-propagation loop and can stay imperative, but should destructure
through `splitLast` twice instead of three index expressions.

### Tasks

- [ ] Rewrite `end` as a fold over `splitLast(stack)`
- [ ] Replace the index arithmetic in `push` with `array` accessors
