## Test helpers for function values, once

**Priority:** P4
**Status:** open

### Problem

A unit test that needs a function value spells the five-argument
`static_function` call out each time, and the handful of shapes it needs are
redeclared per test module:

```rust
// vm/any/call.rs and vm/lambda/mod.rs, byte for byte
fn identity() -> Any<A> {
    A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array(), None).to_any()
}
// vm/lambda/{mod,method,member}.rs, byte for byte; `nanvm_harness::runtime()` is a fourth
fn rt() -> Any<A> { crate::vm::runtime::<A>().unwrap() }
// inline, about twenty times across the `vm` tests
A::static_function(|_, _| Ok(1.0.to_any()), 0, [].to_array(), None).to_any()
A::static_function(|_, _| Err("boom".into()), 0, [].to_array(), None).to_any()
```

`no_args()` is declared twice, `returns(v)` once in `primitive_coercion.rs`
and inline elsewhere. The repetition hides what each test is about — that
the callee throws, that it answers a constant — under how a function value is
constructed. [`vm/test/deep.rs`](../src/vm/test/deep.rs) already exists for
shared test support (`small_stack`, `nested_arrays`, `leak`), so the place
is there.

### Proposal

A sibling `vm/test/function.rs` with `identity()`, `returns(v)`, `throws(v)`,
`rt()` and `no_args()`; the call sites name what the function does. If
`effects-node` and the harness should share them too, the same functions
belong in `vm::unstable` beside `string_any` and `bigint_any`, which already
serve both generated code and tests;
[`lib/tests/test/harness.rs`](../tests/test/harness.rs) has a `function_any`
of the same kind.

### Tasks

- [ ] `vm/test/function.rs`; the duplicated declarations removed.
- [ ] The inline `static_function` fixtures over it, module by module.

### Related

- [shared-test-support](../../effects-node/todo/shared-test-support.md) —
  the same concern across the two crates.
