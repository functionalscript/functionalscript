## bigint-word-layer-owner. BigInt magnitude algorithms exist twice: on `BigInt` and on raw words

**Priority:** P4
**Status:** open

### Problem

`src/vm/bigint/` grew two copies of its magnitude algorithms — one over
`BigInt<A>`, one over `Vec<u64>`/`&[u64]` — because `abs_divmod_vec` needed
word-level versions and got new ones instead of a shared layer:

- **Compare**: `cmp_words` vs `abs_cmp_vec`, both in `mod.rs` — the doc
  comment on `cmp_words` says outright it is "the same rule
  `BigInt::abs_cmp_vec` uses, but over plain words".
- **Subtract with borrow**: `sub_words_assign` vs `abs_sub_vec`, both in
  `mod.rs` — two independent borrow loops for one
  algorithm, one in-place and one allocating, each with its own
  precondition wording.
- **Trim leading zero words**, three spellings: `normalize` in `mod.rs`, the
  inline `while a.last() == Some(&0) { a.pop() }` at the end of
  `sub_words_assign`, and the same `while`
  again in `display.rs`'s division loop.
- **±1 ripple**, three loops: the `+ 1` carry inside
  `magnitude_from_twos_complement`, the `- 1` borrow inside
  `twos_complement_words` (both in `mod.rs`), and `shr.rs`'s
  standalone `fn increment`.

Each pair is the same arithmetic with two owners: a bug found in one loop
(an off-by-one in a borrow, a missed trim) has an independent twin to
re-find.

### Proposal

Make the word layer the single owner of magnitude arithmetic — small free
functions next to `normalize`:

- `cmp_words` stays and `abs_cmp_vec` delegates to it (collect via
  `index_iter`, or compare through `SizedIndex` directly);
- one borrow-loop primitive that both `sub_words_assign` and `abs_sub_vec`
  are expressed through;
- `normalize`/a `trim(&mut Vec<u64>)` used everywhere leading zeros are
  dropped, `display.rs` included;
- `add_one`/`sub_one` ripple helpers used by
  `magnitude_from_twos_complement`, `twos_complement_words`, and
  `shr::increment`.

The `BigInt`-level methods keep their signatures; only their bodies
delegate. No behavior change, so existing tests pin the refactor.

### Tasks

- [ ] Unify the compare and subtract pairs; measure that `abs_divmod_vec`'s
      inner loop keeps its no-`BigInt`-rebuild property.
- [ ] Route the trim and ripple spellings through the shared helpers.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`Iter::zip_longest`](../src/common/iter.rs) — the `BigInt`-level
  walks now stand on it: `abs_add_vec` and `abs_sub_vec` zip their operands
  through it, and `abs_cmp_vec` is a length compare then `Iterator::cmp`
  from the most-significant word. The word-level twins named here are
  untouched; unifying a pair re-expresses the `BigInt`-level side in its
  new shape.
- [`ShiftAmount`](../src/vm/bigint/mod.rs) — `shl`/`shr` share only the
  shift-amount decode, not the carry loops; the ripple helpers here pick
  up `shr.rs`'s `increment`.
- [bigint-normalized-check-reuse](./bigint-normalized-check-reuse.md) —
  the assertion side of normalization; this issue is the operational side.
