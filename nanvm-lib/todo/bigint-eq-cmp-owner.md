## bigint-eq-cmp-owner. `BigInt` equality and ordering are decided by unrelated code paths

**Priority:** P5
**Status:** open

### Problem

`PartialEq` and `Ord` for `BigInt<A>` are computed by two independent owners:

```rust
// src/vm/bigint/partial_eq.rs:3-7 — generic container walk (header, then items)
impl<A: IVm> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

// src/vm/bigint/cmp.rs:12-23 — bigint's own sign dispatch over abs_cmp_vec
let lhs_sign = *self.0.header();
let rhs_sign = *rhs.0.header();
match (lhs_sign, rhs_sign) { ... }
```

`Ord`'s contract requires `cmp(a, b) == Equal` exactly when `a == b`. The two
agree today only because normalization forbids a negative zero (so equal
header + equal items ⇔ compare-equal), but neither file states that
dependency, and the two paths differ operationally: `abs_cmp_vec` panics on
non-normalized input while `items_eq` accepts it. A future representation
tweak that keeps one path correct can silently break the other's agreement.

### Proposal

Make one relation the owner. Either:

1. `PartialEq::eq` delegates: `self.cmp(other) == Ordering::Equal`; or
2. keep the cheap `items_eq` path and add a comment on both impls naming the
   normalization invariant ("no negative zero; items normalized") that makes
   them coincide — plus a debug assertion or proof-level test pinning
   `(a == b) == (a.cmp(&b) == Equal)` across sign/zero cases.

Option 2 preserves the O(1)-bailout equality; option 1 is the smaller rule.

### Tasks

- [ ] Pick a single owner (or document + test the invariant); apply.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [sign-algebra](./sign-algebra.md) — rewrites `cmp.rs`'s four-arm match but
  keeps the two relations separate; independent of this issue.
- [bigint-normalized-check-reuse](./bigint-normalized-check-reuse.md) — the
  normalization invariant this agreement silently depends on.
