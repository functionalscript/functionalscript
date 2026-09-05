## `zip_longest` for the dual-sequence walks

**Priority:** P3
**Status:** open

### Problem

Three hand-rolled "walk two sequences to the longer end" loops, each spelled
differently:

- `abs_add_vec` (`src/vm/bigint/mod.rs:150-169`) — a `loop` over
  `(iter_a.next(), iter_b.next())` with a four-arm match;
- `abs_sub_vec` (`mod.rs:185-205`) — a `for` over `self.index_iter()` with
  `iter_b.next().unwrap_or_default()` inside and a trailing
  `iter_b.next().is_some()` length check;
- `Iter::eq_by_` (`src/common/iter.rs:49-60`) — the same skeleton with an
  equality payload.

`abs_cmp_vec` (`mod.rs:132-140`) hand-rolls a descending index `while` loop
using neither `index_iter` nor iterators. `mod.rs:104` even carries the note
"use .index_iter in abs_* helpers" — recorded, but only partially taken up.

Separately, `Iter::try_reduce` (`iter.rs:17-30`) has zero call sites in
`src/` or `tests/` — 14 lines of `Result`-threading semantics (including a
silent `Ok(default())` on empty) that nothing exercises; §5.4 says extract
once the second real consumer exists. `common/iter.rs` carries an unused
combinator while three call sites hand-roll a missing one.

### Proposal

Add `Iter::zip_longest(self, other)` to `common/iter.rs` (it already has
`Either`, exactly the machinery needed). Then:

- `abs_add_vec` becomes a scan over the carry;
- `abs_sub_vec` becomes a scan over the borrow, the over-long-`rhs` case
  falling out of the pair shape;
- `eq_by_` becomes `zip_longest(...).all(...)`;
- `abs_cmp_vec` becomes
  `len_a.cmp(&len_b).then_with(|| /* reversed lexicographic compare */)`.

Remove `try_reduce` (restore it when a consumer appears).

### Tasks

- [ ] Add `zip_longest` with tests
- [ ] Convert the four walks; delete `try_reduce`

### Related

- [bigint-shift-decode](bigint-shift-decode.md) — explicitly rules the
  mirrored carry loops out of its scope; this issue picks them up
- [bigint-word-layer-owner](bigint-word-layer-owner.md) — the word-slice
  twins (`cmp_words`, `sub_words_assign`, the trim/ripple spellings) this
  issue's `BigInt`-level rewrite does not reach; whichever lands second
  re-expresses the other's result
