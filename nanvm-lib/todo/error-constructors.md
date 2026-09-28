## One owner for thrown error values

**Priority:** P3
**Status:** open

### Problem

Every error the VM can throw is built by `"literal".into()` at the throw
site, with three naming conventions and no shared constructor:

- `src/vm/impls/try_from.rs` — a file-local
  `fn error<A: IVm, T>() -> Result<T, Any<A>>` returning `"Type Error"`;
- `src/vm/number_coercion.rs`, `NumberCoercion`'s `bigint` arm —
  `"TypeError: Cannot convert a BigInt value to a number"`;
- `src/vm/primitive_coercion.rs` — a file-local
  `const CANNOT_CONVERT_TO_PRIMITIVE_VALUE`;
- `src/vm/numeric.rs` — a file-local
  `CANNOT_MIX_NUMBER_AND_BIGINT` constant shared by several operators;
- `src/vm/bigint/shl.rs` — a file-local `TOO_LARGE` const plus a
  `too_large()` wrapper, i.e. one file already invented the missing
  abstraction privately.

Nothing enforces that a thrown value is even TypeError-shaped, and when real
`Error` objects land (per the ECMAScript references in these files) every
site must be edited in lockstep. The `shl` message additionally leaks into
test assertions (`shl.rs`'s `tests` module), so it is load-bearing with no single
definition.

### Proposal

A `vm/error.rs` owning the thrown-value vocabulary:
`fn type_error<A: IVm, T>(message: &str) -> Result<T, Any<A>>` plus named
constructors for the recurring cases (`cannot_convert_to_primitive`,
`bigint_to_number`, `mixed_numeric_operands`, `shift_amount_too_large`).
`try_from::error` and `shl::too_large` collapse into calls; "what does a
thrown value look like" becomes one module's decision.

### Tasks

- [ ] Add `vm/error.rs` with the constructors
- [ ] Convert the five sites and the `shl` test assertions

### Related

- [131](131-non-panicking-allocator.md) — the allocator's failure channel, a different concern
