## 66x-sign-algebra. Give `Sign` its full small algebra (product and ordering, not just `flip`)

**Priority:** P4
**Status:** open

### Problem

`src/sign.rs` is a bare enum with zero methods:

```rust
#[repr(i8)]
#[derive(PartialEq, Debug, Clone, Copy)]
pub enum Sign {
    Positive = 1,
    Negative = -1,
}
```

so every bigint operator open-codes its own sign logic.
[bigint-add-sub-mirror](./bigint-add-sub-mirror.md) already owns the
*"`Sign` needs methods"* thread, but scopes it to `Sign::flip` (for
`add`/`sub`/`neg`). Two more inlined sign computations are not covered
there:

The sign **product** in `src/vm/bigint/mul.rs:37-41`:

```rust
let sign = if self.0.header() == rhs.0.header() {
    Sign::Positive
} else {
    Sign::Negative
};
```

and the sign **dispatch** for ordering in `src/vm/bigint/cmp.rs:17-22`:

```rust
match (lhs_sign, rhs_sign) {
    (Sign::Positive, Sign::Negative) => Ordering::Greater,
    (Sign::Negative, Sign::Positive) => Ordering::Less,
    (Sign::Positive, Sign::Positive) => self.clone().abs_cmp_vec(rhs.clone()),
    (Sign::Negative, Sign::Negative) => rhs.clone().abs_cmp_vec(self.clone()),
}
```

Sign arithmetic is re-derived in each operator file instead of living on
the `Sign` type.

### Proposal

When the `Sign` methods land (per
[bigint-add-sub-mirror](./bigint-add-sub-mirror.md)), add the full small
algebra next to the enum rather than just `flip`:

- `impl Mul for Sign` — same-sign → `Positive`, different → `Negative`
  (a two-arm `match`/`if` on `self == rhs`; no need to round-trip through
  `i8`). `mul.rs`'s four lines become `let sign = lhs_sign * rhs_sign;`.
- An ordering helper on `Sign`, e.g.
  `fn cmp_with(self, rhs: Sign, abs: impl FnOnce(bool) -> Ordering) -> Ordering`
  or simply `impl Ord for Sign` (`Negative < Positive`) so `cmp.rs` handles
  only the equal-sign arms and delegates the mixed-sign case to
  `lhs_sign.cmp(&rhs_sign)`. Pick whichever leaves `cmp.rs` smallest —
  deriving `Ord` on the enum plus a two-arm equal-sign match is likely the
  cleanest.

This keeps the sign axis in one place (`sign.rs`) and each operator file
scoped to magnitude work.

### Tasks

- [ ] Add `impl Mul for Sign` (or an equivalent method) in `src/sign.rs`;
      use it in `mul.rs`.
- [ ] Add ordering support on `Sign` (`derive`d or explicit `Ord`); rewrite
      `cmp.rs`'s four-arm match to equal-sign arms + delegation.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [bigint-add-sub-mirror](./bigint-add-sub-mirror.md) — introduces
  `Sign::flip`; this issue extends the same "put sign logic on `Sign`"
  direction to `mul` and `cmp`.
