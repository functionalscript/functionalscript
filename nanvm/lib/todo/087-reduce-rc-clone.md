## 87. Borrow `Any` for read-only operations

**Priority:** P3
**Status:** wip

### Problem

Many operations consume `Any<A>` even when they only inspect the operand.
Callers that retain a value must clone it before each use; reading operands
from borrowed containers also requires explicit clones. This makes ownership
harder to follow and, for `Naive` container values, can add `Rc` increments
and decrements.

`Any<A>` wraps an `A: IVm`, not an `Rc<AnyImpl>` as the original sketch here
assumed. The obstacle extends below the public methods:
[`IVm::to_unpacked(self)`](../src/vm/internal/mod.rs),
[`From<Any<A>> for Unpacked<A>`](../src/vm/any/from.rs), and
[`Unpacked::dispatch(self, ...)`](../src/vm/unpacked.rs) consume their inputs.
Even `Any::is_nullish(&self)` clones to unpack. Changing signatures alone
could move the clones inside the implementation without removing them.

### Proposal

Use `&self` and `&Any<A>` for operations that only need to borrow their
operands. Start with inspection, such as `is_nullish`, `is_nan`,
`to_boolean`, and `typeof_`, and carry borrowing through unpacking and
dispatch. The mechanism must work for packed VM representations as well as
`Naive`; a packed value need not contain an `Unpacked` enum that can be
returned by reference.

Consider reference operator implementations so callers can write `&a + &b`.
Keep ownership-taking paths where they transfer values into containers,
captures, or results, or let a conversion reuse an owned value. Clone at the
point an independent owned value is actually needed.

The primary goal is a clearer API with fewer unnecessary clones. `&Any<A>`
expresses borrowing; the compiler may eliminate indirection or pass data in
registers when observable behavior is preserved. It does not guarantee a
particular calling convention or a speedup. Measure performance before
making performance claims.

### Tasks

- [ ] Audit `Any` operations and their callers for borrowing versus ownership
      transfer; choose a small first scope of inspection operations.
- [ ] Design and implement borrowing through the VM inspection/dispatch path
      without requiring a reference to an unpacked enum inside every VM.
- [ ] Convert the selected operations and their consumers together, removing
      clones rather than relocating them; assess borrowed operator support.
- [ ] Verify value semantics, errors, and operand reuse with focused tests;
      run `cargo test`, `cargo clippy -- -D warnings`, and
      `cargo fmt -- --check` for the Rust changes.
- [ ] Compare representative workloads if claiming a performance improvement,
      including callers that retain operands and callers that can move them.

### Related

- [Rust Unpack dispatch](./089-rust-unpack-dispatch.md) — the existing dispatch
  design and a separate proposal for compile-time operation tags.
