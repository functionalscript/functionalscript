## Share the test support between `effects-node` and the harness

**Priority:** P4
**Status:** open

### Problem

The tests of this crate and of [`nanvm/harness`](../../harness) build the same
fixtures by hand:

- **A scratch directory.** [`src/scratch.rs`](../src/scratch.rs)'s `Scratch`
  numbers each directory from a per-process counter and canonicalizes it on
  Unix. [`harness/tests/parity.rs`](../../harness/tests/parity.rs) has a
  second `Scratch` with neither, so a parity case that creates two
  directories under one name, or compares a path through a symlinked
  `temp_dir`, behaves differently from the unit test beside the code.
- **The buffered host.** `Native<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>>` is
  constructed in `native.rs`'s tests and in the harness's `effects.rs`,
  `parity.rs` and `console.rs`, each with its own `host()` function.
- **Unwrapping a `['ok', v]` tuple.** `codec.rs` has `encode_result` and no
  inverse, so `lib.rs`'s tests, `native.rs`'s `ok`, the harness's
  `common/mod.rs` `perform_case` and `effects.rs` each write
  `let [tag, value]: [V; 2] = Array::try_from(…)…; assert_eq!(tag, string_any("ok"))`.
- **Re-spelled encoders.** `lib.rs`'s test `result(tag, v)` is
  `codec::encode_tuple`, its `node(…)` is `encode_object`, and `native.rs`'s
  test `object(members)` is `encode_object` again.

### Proposal

- `codec::decode_result(any) -> Result<Result<Any<A>, Any<A>>, Malformed>`,
  the inverse of `encode_result`, used wherever a test unwraps the tuple.
- A constructor for the in-memory host,
  `Native::<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>>::buffered(input: &[u8])`,
  replacing the four `host()` functions.
- One `Scratch` the harness can reach: `pub` behind a `test-support` feature
  of this crate, which the harness already has as a dev-dependency, or a
  small shared dev crate. The parity test then gets the counter and the
  canonicalization it lacks.
- The `lib.rs` and `native.rs` tests call `codec`'s encoders instead of
  re-spelling them.

### Tasks

- [ ] `decode_result`, `Native::buffered`; tests over them.
- [ ] One `Scratch`; delete the harness copy.
- [ ] Replace the re-spelled encoders in the tests.

### Related

- [document-nanvm-harness](../../harness/todo/document-nanvm-harness.md) —
  the harness's own documentation, where the shared support is named.
- [nanvm-effects-node-operations](../../../todo/nanvm-effects-node-operations.md)
  — the parity corpus these tests run.
