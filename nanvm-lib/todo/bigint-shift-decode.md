## bigint-shift-decode. `Shl`/`Shr` duplicate the shift-amount decode

**Priority:** P4
**Status:** open

### Problem

`vm/bigint/shl.rs:18-30` and `vm/bigint/shr.rs:13-25` open with the same
prelude — decode the shift amount from a `BigInt` right-hand side —
differing only in the degenerate-case results:

```rust
// shl.rs
let n_len = self.length();
if n_len == 0 { return Ok(self); }
let shift = match rhs.length() {
    0 => return Ok(self),
    1 => rhs[0],
    _ => return too_large(),          // <- differs
};
let (word_shift, bit_shift) = shift.div_mod(64);

// shr.rs
let n_len = self.length();
if n_len == 0 { return self; }
let shift = match rhs.length() {
    0 => return self,
    1 => rhs[0],
    _ => return Self::default(),      // <- differs
};
let (word_shift, bit_shift) = shift.div_mod(64);
```

The bit-shift carry loops further down are mirror images and genuinely
different — leave those. The decode prelude is the shared part, and it must
stay in sync (e.g. if multi-word shift amounts are ever supported, both
sites change).

### Proposal

A private helper on `BigInt<A>` (plain generic method, no macro):

```rust
/// Decoded (word_shift, bit_shift), or None when the operand is empty or
/// the amount doesn't fit one word — the caller picks its degenerate result.
fn shift_amount(&self, rhs: &Self) -> Option<(u64, u64)> {
    if self.length() == 0 { return None; }
    let shift = match rhs.length() {
        0 => return None,
        1 => rhs[0],
        _ => return None,
    };
    Some(shift.div_mod(64))
}
```

Caveat: the three `None` cases map to *different* results in `shl`
(`Ok(self)`, `Ok(self)`, `too_large()`), so a single `Option` is too
coarse — either return a small enum
(`enum ShiftDecode { Noop, TooWide, Amount(u64, u64) }`) or keep the
zero-length checks at the call sites and share only the one-word decode.
Pick whichever leaves `shl`/`shr` reading as a `match` with the op-specific
values in the arms.

### Tasks

- [ ] Extract the decode with an explicit `Noop`/`TooWide`/`Amount`
      discrimination; rewrite `shl`/`shr` on top.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- `vm/bigint/mod.rs` `abs_add_vec`/`abs_sub_vec`/`abs_cmp_vec` — precedent
  for shared bigint helpers.
