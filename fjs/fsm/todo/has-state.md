## has-state. `hasState` intersects where `sorted_set` already has `has`

**Priority:** P5
**Status:** open

### Problem

A state set is a sorted set, and the collection exports a membership
test built on binary search. `fjs/fsm` tests membership by building a
one-element list and merging it against the set:

```js
const hasState = s => set => !isEmpty(intersect(cmp)([s])(set))
```

which is linear where `has(cmp)(value)(set)` is logarithmic, and a
second spelling of an operation the owner already names. Beside it,
`addEntry` reads the DFA table through the imported `at`, and `runOp`
bypasses it with `dfa[s] ?? []`.

### Proposal

`hasState` is `has(cmp)` from `fjs/types/sorted_set`, with the
arguments in its order; the `isEmpty` and `intersect` imports go.
`runOp` reads through `at`, so the table has one lookup path.

### Tasks

- [ ] Both replacements; `tsc`, `fjs test`.
