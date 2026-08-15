## bigint-sign-accessor. `*self.0.header()` is open-coded in eight bigint files

**Priority:** P4
**Status:** open

### Problem

`BigInt<A>` stores its sign as the container header but exposes no accessor,
so every operator file reaches through the private tuple field into the
generic container — ten sites in eight files under `src/vm/bigint/`:

```rust
// mod.rs:78      let lhs_sign = *self.0.header();
// cmp.rs:14-15   let lhs_sign = *self.0.header();  let rhs_sign = *rhs.0.header();
// add.rs:8       let rhs_sign = *rhs.0.header();
// sub.rs:8       let rhs_sign = rhs.0.header().flip();
// neg.rs:14      Self::unchecked_new(self.0.header().flip(), self.index_iter())
// mul.rs:37      if self.0.header() == rhs.0.header() {
// shl.rs:61      Ok(Self::unchecked_new(*self.0.header(), value))
// shr.rs:41      Self::normalize_new(*self.0.header(), value)
// debug.rs:13    if *self.0.header() == Sign::Negative {
```

This is also why most `bigint/*.rs` files carry a `use crate::vm::IContainer`
import they need for nothing else. The crate already has the right shape one
directory over: `Function<A>` exposes `name()`/`length()` instead of letting
callers read `self.0.header().0`, and `BigInt` itself already wraps one
container access in `is_zero()` (`mod.rs:45-47`).

### Proposal

```rust
// src/vm/bigint/mod.rs, next to is_zero():
pub(crate) fn sign(&self) -> Sign {
    *self.0.header()
}
```

Route the ten sites through it (`rhs.sign()`, `self.sign().flip()`, …) and
drop the now-unneeded `IContainer` imports.

### Tasks

- [ ] Add `sign()`; rewrite the ten sites; prune imports.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [sign-algebra](./sign-algebra.md) — gives `Sign` its algebra once the sign
  is in hand; this issue is about how the sign is *read*.
