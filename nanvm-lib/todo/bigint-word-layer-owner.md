## bigint-word-layer-owner. BigInt magnitude algorithms exist twice: on `BigInt` and on raw words

**Priority:** P4
**Status:** open

### Problem

`src/vm/bigint/` grew two copies of its magnitude algorithms — one over
`BigInt<A>`, one over `Vec<u64>`/`&[u64]` — because `abs_divmod_vec` needed
word-level versions and got new ones instead of a shared layer:

- **Compare**: `cmp_words` (`mod.rs:49-61`) vs `abs_cmp_vec` — the doc
  comment on `cmp_words` says outright it is "the same rule
  `BigInt::abs_cmp_vec` uses, but over plain words".
- **Subtract with borrow**: `sub_words_assign` (`mod.rs:93-109`) vs
  `abs_sub_vec` (`mod.rs:265-293`) — two independent borrow loops for one
  algorithm, one in-place and one allocating, each with its own
  precondition wording.
- **Trim leading zero words**, three spellings: `normalize`
  (`mod.rs:35-41`), the inline `while a.last() == Some(&0) { a.pop() }` at
  the end of `sub_words_assign` (`mod.rs:106-108`), and the same `while`
  again in `display.rs`'s division loop.
- **±1 ripple**, three loops: the `+ 1` carry inside
  `magnitude_from_twos_complement` (`mod.rs:74-85`), the `- 1` borrow
  inside `twos_complement_words` (`mod.rs:345-353`), and `shr.rs`'s
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

- [zip-longest](./zip-longest.md) — refactors the `BigInt`-level walks
  (`abs_add_vec`/`abs_sub_vec`/`abs_cmp_vec`/`eq_by_`) onto a
  `zip_longest` combinator; complementary and order-sensitive: whichever
  lands second re-expresses the other's result, so coordinate — landing
  `zip_longest` alone leaves the word-level twins named here in place.
- [bigint-shift-decode](./bigint-shift-decode.md) — rules the shift carry
  loops out of its own scope; the ripple helpers here pick up its
  `increment`.
- [bigint-normalized-check-reuse](./bigint-normalized-check-reuse.md) —
  the assertion side of normalization; this issue is the operational side.
