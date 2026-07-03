## `BigInt`: `Sub` sign bug in the `Less` arm; `Add`/`Sub` duplicate the sign dispatch

**Priority:** P2
**Status:** open

### Problem

#### 1. Correctness: `Sub` returns the wrong sign when `|lhs| < |rhs|`

`vm/bigint/sub.rs`:

```rust
let (sign, vec) = if lhs_sign == rhs_sign {
    match self.clone().abs_cmp_vec(rhs.clone()) {
        Ordering::Equal => return Self::default(),
        Ordering::Greater => (lhs_sign, self.abs_sub_vec(rhs)),
        Ordering::Less => (rhs_sign, rhs.abs_sub_vec(self)),   // ← bug
    }
} else {
    (lhs_sign, self.abs_add_vec(rhs))
};
```

The `Less` arm is only reached when `lhs_sign == rhs_sign`, and subtraction
must **flip** the sign there: `(+3) - (+5) = -2`, but the code produces
`(rhs_sign = Positive, |5| - |3| = 2)` → `+2`. Likewise
`(-3) - (-5)` yields `-2` instead of `+2`. The arm was mirror-copied from
`add.rs`, where `(rhs_sign, …)` is correct because that arm runs when the
signs *differ* (`(+3) + (-5) = -2`, the sign of the larger magnitude — `rhs`).
In `sub` the signs are *equal* in that branch, so `rhs_sign` is just
`lhs_sign` and the flip is lost.

Verified empirically with a throwaway integration test against
`BigInt<Naive>`: `3 - 5` asserts equal to `-2` and fails with
`left: 0x2n, right: -0x2n`.

`sub.rs` is also the only bigint operator file with **no unit tests** (`add`,
`shl`, `shr`, `cmp`, `mul` all have `#[cfg(test)]` modules), which is why the
copy-paste survived.

#### 2. DRY: the sign dispatch exists twice (and enabled the bug)

`add.rs` and `sub.rs` are the same body with the two branches of the
`lhs_sign == rhs_sign` conditional swapped. The magnitude kernels are already
shared (`abs_add_vec` / `abs_sub_vec` / `abs_cmp_vec` in `vm/bigint/mod.rs`);
the duplicated part is the signed dispatch above them. The two operators
differ in exactly one bit of information — whether the effective sign of `rhs`
is kept (`add`) or flipped (`sub`), because `a - b = a + (-b)`. Maintaining
the dispatch twice is what made the incorrect mirror-edit possible, and any
future fix touching one copy risks missing the other.

### Proposal

Fix the bug *by* removing the duplication: one signed-combine helper in
`vm/bigint/mod.rs`, parameterized by the effective right-hand sign; both
operators become one-liners and the `Less`-arm sign is derived correctly for
both from a single source.

```rust
impl<A: IVm> BigInt<A> {
    /// `self + (rhs with its sign replaced by `rhs_sign`)`.
    fn add_signed(self, rhs: Self, rhs_sign: Sign) -> Self {
        let lhs_sign = *self.0.header();
        let (sign, vec) = if lhs_sign == rhs_sign {
            (lhs_sign, self.abs_add_vec(rhs))
        } else {
            // Signs differ: result takes the sign of the larger magnitude.
            match self.clone().abs_cmp_vec(rhs.clone()) {
                Ordering::Equal => return Self::default(),
                Ordering::Greater => (lhs_sign, self.abs_sub_vec(rhs)),
                Ordering::Less => (rhs_sign, rhs.abs_sub_vec(self)),
            }
        };
        Self::unchecked_new(sign, vec)
    }
}

// add.rs
fn add(self, rhs: Self) -> Self {
    let rhs_sign = *rhs.0.header();
    self.add_signed(rhs, rhs_sign)
}

// sub.rs
fn sub(self, rhs: Self) -> Self {
    let rhs_sign = (*rhs.0.header()).flip(); // add a `Sign::flip` helper
    self.add_signed(rhs, rhs_sign)
}
```

With the *effective* `rhs_sign` threaded in, the `Less` arm's `(rhs_sign, …)`
is right in both uses — for `sub` it is the flipped sign, which is exactly the
fix for bug 1.

Notes:

- Alternative considered: `fn sub(self, rhs) { self + (-rhs) }` via the
  existing `Neg` impl — the shortest expression of the algebra, and it would
  also have fixed the bug. But `Neg` rebuilds the container
  (`unchecked_new(…, self.index_iter())` copies every word), adding an
  allocation per subtraction in a VM hot path; the `rhs_sign` parameter gives
  the same single-source dispatch at zero cost. Note the choice in a comment
  so the `-rhs` form isn't "simplified" back in later.
- `Sign` has no flip yet; `neg.rs`'s inline `match` is a second copy of that
  idea — add `Sign::flip` (or `impl Neg for Sign`) next to the enum and use it
  from `neg.rs` too.
- Add the missing `sub.rs` unit tests, at minimum: `3 - 5 == -2`,
  `(-3) - (-5) == 2`, `5 - 3 == 2`, `a - a == 0`, mixed signs
  `3 - (-5) == 8`, `(-3) - 5 == -8`, and a multi-word borrow case.

### Tasks

- [ ] Add `Sign::flip`; use it in `neg.rs`.
- [ ] Add `add_signed` in `vm/bigint/mod.rs`; rewrite `Add`/`Sub` on top of it.
- [ ] Add `sub.rs` unit tests covering both signs of the `Less` arm (the bug),
      plus the cases listed above.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check` clean.

### Related

- [i159](159.md) — wrapper-trait boilerplate; notes the `abs_*` kernels are
  already shared. This issue removes the remaining duplication one layer up.
- [bigint-shift-decode](bigint-shift-decode.md) — the same "mirrored operator
  pair shares a prelude" pattern for `Shl`/`Shr`.
- [single-source-of-truth-for-operator-tests](single-source-of-truth-for-operator-tests.md)
  — the missing-`sub`-tests gap this bug slipped through.
