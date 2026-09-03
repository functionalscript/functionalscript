## `undeclaredMembers` scans `declared` linearly per member

**Priority:** P3
**Status:** open

### Problem

`undeclaredMembers` in [`../common/module.f.mjs`](../common/module.f.mjs)
answers "is `k` declared?" with `declared.some(d => d === k)` — a linear scan
per member of the value. A tuple's own index `i` sits at position `i` of its
`declared` list, so a dense `n`-position tuple pays `Σ i ≈ n²/2` string
comparisons per read, and the whole walk is quadratic while everything around
it is linear. Measured (`undeclaredMembers` alone, dense all-present tuple):
0.7 s at 25 000 positions, 3.3 s at 50 000 — 4× per doubling. Review of #1748
measured the same shape end to end: ~17–31 s at 100 000 positions, ~48 s at
200 000, identical on the parent commit, so this predates stage 2 of
`option`-as-omission and none of the readers' recent changes moved it.

Every reader pays it — `parse`, `validate` and the data form's `validate` all
route undeclared members through this one walk (which is the point of the
shared rule; see the function's own doc) — but only the *array* kind at
scale: a struct's `declared` list is its key list, rarely large.

### Tasks

- [ ] Answer membership in O(1): build the membership test once from
      `declared` (`new Set(declared)` is the §3.1-sanctioned construction)
      — or better, once per **schema** rather than per call, since every
      caller already hoists `declared` from `rttiEntries` in a per-schema
      closure and the data reader can derive it from `p.prefix`/`p.props`
      the same way.
- [ ] Keep the observable behavior bit-identical: `undeclaredMembers`' member
      *order* and the non-index/beyond-`length` rules are pinned by the
      three-reader tables, and must not move.
- [ ] Pin the complexity the way `readIndices`' doc pins its own linear walk:
      a measurement in the JSDoc, not a timing assert in a proof.
