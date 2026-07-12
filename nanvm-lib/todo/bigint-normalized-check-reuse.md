## bigint-normalized-check-reuse. `shl` restates the normalization invariant by hand

**Priority:** P5
**Status:** open

### Problem

`nanvm-lib/src/vm/bigint/shl.rs:56-59` hand-writes a
normalized-and-nonempty postcondition:

```rust
assert!(
    value.last() != Some(&0) && !value.is_empty(),
    "shl: result must be normalized and non-empty"
);
```

restating the invariant already centralized in `assert_slice_normalized`
(`nanvm-lib/src/vm/bigint/mod.rs:212-219`, panics on a leading zero word).
The "is this normalized" predicate is thus expressed in two places that can
drift; `shl` additionally checks non-emptiness, which the shared helper does
not cover.

### Proposal

Route `shl`'s postcondition through the shared helper —
`assert_slice_normalized(value.as_slice())` plus a separate
`assert!(!value.is_empty(), …)` — or extend `assert_slice_normalized` with a
non-empty sibling if a second caller wants the combined check. Low priority;
bundle into any bigint cleanup that touches `shl`.

### Tasks

- [ ] Reuse `assert_slice_normalized` in `shl.rs`; keep the non-empty check
      explicit.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [bigint-shift-decode.md](./bigint-shift-decode.md) — the shift-amount
  decode prelude shared by `shl`/`shr`; different part of the same functions.
