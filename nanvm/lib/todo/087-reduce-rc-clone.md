## 87. Borrow `Any` for read-only operations

**Priority:** P3
**Status:** wip

### Problem

The original inspection APIs consumed `Any<A>` even when they only read the
operand. Callers retaining a value had to clone it before each use, as did
callers reading operands from borrowed containers. This made ownership harder
to follow and, for `Naive` container values, could add `Rc` increments and
decrements.

`Any<A>` wraps an `A: IVm`, not an `Rc<AnyImpl>` as the original sketch here
assumed. The obstacle extends below the public methods:
[`IVm::to_unpacked(self)`](../src/vm/internal/mod.rs),
[`From<Any<A>> for Unpacked<A>`](../src/vm/any/from.rs), and
[`Unpacked::dispatch(self, ...)`](../src/vm/unpacked.rs) consume their inputs.
Even `Any::is_nullish(&self)` formerly cloned to unpack. Changing signatures
alone would move the clones inside the implementation without removing them.
Inspection now uses `IVm::with_unpacked`; borrowing through coercions and
arithmetic, and avoiding the serializer's local-read clones, remain open.

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

- [x] Audit `Any` operations and their callers for borrowing versus ownership
      transfer; choose a small first scope of inspection operations.
- [x] Design and implement borrowing through the VM inspection/dispatch path
      without requiring a reference to an unpacked enum inside every VM.
- [x] Convert inspection operations and their consumers together, removing
      clones rather than relocating them; support logical negation of `&Any`.
- [x] Verify value semantics and operand reuse with focused tests that refuse
      cloning and consuming unpacking during inspection; run `cargo test`,
      `cargo clippy -- -D warnings`, and `cargo fmt -- --check`.
- [ ] Extend borrowing to coercions and arithmetic where it simplifies their
      ownership contract; assess borrowed binary operators and verify errors.
- [ ] Let the Rust serializer print borrowed local reads for inspection,
      avoiding its current clone of a binding before borrowing the result.
- [ ] Compare representative workloads if claiming a performance improvement,
      including callers that retain operands and callers that can move them.

The first implementation uses `IVm::with_unpacked` for inspection callbacks.
`is_nullish`, `is_nan`, truthiness, type checks, equality, and formatting
borrow through this interface; `defined` checks without cloning before it
returns ownership. Consuming coercions and arithmetic remain available for
ownership transfers. The Rust serializer's inspection calls now borrow their
arguments, while its ordinary local-read emission still clones; that needs a
structural borrowed-expression mode rather than rewriting emitted text.

### Related

- [Rust Unpack dispatch](./089-rust-unpack-dispatch.md) — the existing dispatch
  design and a separate proposal for compile-time operation tags.
