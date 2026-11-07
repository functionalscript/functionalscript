## A reader of the runtime value's functions

**Priority:** P4
**Status:** open

### Problem

The runtime value's shape, `static`, `dot` and `in` as own functions, is
fixed by [`vm/runtime.rs`](../src/vm/runtime.rs)'s README, but the module
that owns the value exports no reader of it, so each consumer unpacks it
its own way and answers a missing field its own way. `Member::body` in
[`vm/lambda/member.rs`](../src/vm/lambda/member.rs) unpacks to an object,
asks `member_access("dot")`, tries `Function::try_from`, and answers `None`
at each miss; `static_read` in [`vm/unstable`](../src/vm/unstable/mod.rs)
goes through `dot(string_any("static")).end()` and `call`, so a runtime
without `static` fails with an incidental `TypeError` from calling
`undefined`; the tests of `runtime.rs` keep a third pair, `at` and
`static_at`.

### Proposal

`runtime.rs` owns `pub(crate) fn function<A: IVm>(runtime: &Any<A>, name:
&str) -> Option<Function<A>>`, an own property that is a function or
`None`. `Member::body` and `static_read` read through it, and `static_read`
states, in the one place, what a runtime without `static` means, which the
open issue below asks of it anyway.

### Tasks

- [ ] `function` in `runtime.rs`; both readers over it.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`unstable/todo/object-entries-runtime-binding`](../src/vm/unstable/todo/object-entries-runtime-binding.md)
  — the missing-provider contract of `static_read`.
- [in-native-substitution](./in-native-substitution.md) — the `in` reader
  to come, a third consumer.
