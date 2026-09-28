## `packidx` bisects with `bsearch`

**Priority:** P5
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs) writes two binary searches of its own,
each a recursion over `[lo, hi)` with `lo + Math.floor((hi - lo) / 2)`:

- `upTo`, the count of first bytes at or below `k`, which `fanoutAgrees`
  compares with each fanout entry;
- `offsetIn`, the bisection behind `offsetOf`.

Both are called over the whole array, from `0` to its length, so the bounds
they carry never vary between callers.
[`fjs/types/function/compare`](../../../types/function/compare/module.f.mjs)
already exports that search as `bsearch`, which `types/range_map`,
`types/range_set` and `types/sorted_list` use: given a monotonic probe it
answers the index of a hit, or the insertion point on a miss. Checked at
`36c8d4a`:

- `upTo(firsts, k, 0, firsts.length)` is
  `bsearch(firsts.length)(mid => firsts[mid] <= k ? 1 : -1)`, whose probe
  never answers `0` and so lands on the count;
- `offsetIn` is `bsearch(ids.length)` over the comparison of `target` with
  `uint(ids[mid])`, followed by the check that the answer is a hit.

Each copy restates a loop the repository has one proven version of, and
their JSDoc explains a closure-free shape that the shared function makes
unnecessary.

### Proposal

Replace both with `bsearch`, and drop the `lo`/`hi` parameters with them.
`upTo` runs once per fanout bucket, so measure an index read before and
after on a large index.

### Tasks

- [ ] `upTo` and `offsetIn` through `bsearch`; their JSDoc says what they
      ask, not how they bisect.
- [ ] Measure an index read on a large index before and after.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/todo/lifted-captures.md`](../../../todo/lifted-captures.md) — lists
  `offsetIn` for its lifted parameters; if this lands first, that entry goes
  with the function.
- [lazy-index-ids.md](./lazy-index-ids.md) — what a lookup in an index costs
  otherwise.
