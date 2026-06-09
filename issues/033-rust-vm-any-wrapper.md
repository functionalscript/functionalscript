# 33. Rust: VM: implement `Any` and other types as wrappers.

**Priority:** P3
**Status:** done

```rust
struct Any<A: AnyPolicy>(A);
```

This way we can implement operations on it, such as `+`.

## Resolution

Implemented in `nanvm-lib`:

- [`nanvm-lib/src/vm/any/mod.rs`](../nanvm-lib/src/vm/any/mod.rs) defines
  `pub struct Any<A: IVm>(A)` and wrapper methods such as `unary_plus`,
  `to_string`, `to_number`, and `to_numeric`.
- [`nanvm-lib/src/vm/any/add.rs`](../nanvm-lib/src/vm/any/add.rs) implements
  `Add` for `Any<A>`.
- [`nanvm-lib/src/vm/impls/mul.rs`](../nanvm-lib/src/vm/impls/mul.rs)
  implements `Mul` for `Any<A>`.
- [`nanvm-lib/src/vm/mod.rs`](../nanvm-lib/src/vm/mod.rs) exports `Any` and the
  other VM wrapper types.
