## sign-algebra. Give `Sign` its full small algebra (product and ordering, not just `flip`)

**Priority:** P4
**Status:** open

### Problem

`src/sign.rs` carries only `Sign::flip` (added for `add`/`sub`/`neg` when
the mirrored `Add`/`Sub` dispatch was unified into `BigInt::add_signed`),
so the remaining bigint operators still open-code their own sign logic.
Two inlined sign computations are not covered by `flip`:

The sign **product** in `src/vm/bigint/mul.rs:37-41`:

```rust
let sign = if self.sign() == rhs.sign() {
    Sign::Positive
} else {
    Sign::Negative
};
```

— which `src/vm/bigint/div.rs:18-22` repeats byte-for-byte: the quotient's
sign is the same product, so `impl Mul for Sign` has a second consumer
already.

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

Add the full small algebra next to the enum rather than just `flip`:

- `impl Mul for Sign` — same-sign → `Positive`, different → `Negative`
  (a two-arm `match`/`if` on `self == rhs`; no need to round-trip through
  `i8`). `mul.rs`'s four lines become `let sign = lhs_sign * rhs_sign;`.
- An ordering helper on `Sign`, e.g.
  `fn cmp_with(self, rhs: Sign, abs: impl FnOnce(bool) -> Ordering) -> Ordering`
  or `Ord` on the enum (`Negative < Positive`) so `cmp.rs` handles
  only the equal-sign arms and delegates the mixed-sign case to
  `lhs_sign.cmp(&rhs_sign)`. Deriving is the cleanest and is **correct as
  declared**: derived `Ord` on a fieldless enum follows the discriminant
  *values*, and `src/sign.rs:4-5` sets them explicitly (`Positive = 1`,
  `Negative = -1`), so a bare derive yields `Negative < Positive` —
  declaration order would matter only if the discriminants were implicit.
  What the derive list actually needs is `Eq, PartialOrd, Ord` added to
  the current `PartialEq, Debug, Clone, Copy` (`:2`), and a test pinning
  `Sign::Negative < Sign::Positive` so the ordering the operators rely on
  is stated somewhere the discriminants cannot silently drift from.

This keeps the sign axis in one place (`sign.rs`) and each operator file
scoped to magnitude work.

### Tasks

- [ ] Add `impl Mul for Sign` (or an equivalent method) in `src/sign.rs`;
      use it in `mul.rs` and `div.rs`.
- [ ] Add ordering support on `Sign` (`derive`d or explicit `Ord`); rewrite
      `cmp.rs`'s four-arm match to equal-sign arms + delegation.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- `Sign::flip` in `src/sign.rs` and `BigInt::add_signed` in
  `src/vm/bigint/mod.rs` — the first step of putting sign logic on `Sign`
  (done, was `bigint-add-sub-mirror`); this issue extends the same
  direction to `mul` and `cmp`.
