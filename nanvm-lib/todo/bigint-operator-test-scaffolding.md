## bigint-operator-test-scaffolding. Shared test helpers for the bigint operator modules

**Priority:** P4
**Status:** open

### Problem

Every bigint operator file redeclares the same inline unit-test scaffolding
in `nanvm-lib/src/vm/bigint/`:

- `type T = BigInt<Naive>` + `fn int(value: i64) -> T { value.into() }` —
  duplicated in `add.rs:19-23`, `sub.rs:19-23`, `mul.rs:53-57`.
- `type T` + `fn pos(items: Vec<u64>) -> T` / `fn neg(items: Vec<u64>) -> T`
  (both `T::unchecked_new(...)`) — duplicated in `shl.rs:68-79` and
  `shr.rs:45-57`.
- `mod.rs:229` uses a parallel `type TestBigInt = BigInt<Naive>`.

The identical comment
`// TODO: The unit tests should not use \`naive\` or other VM implementations.
//       We should move these tests into integration tests.` is itself
copy-pasted at `add.rs:13`, `sub.rs:13`, `mul.rs:47` (and as
`// TODO: move these tests to integration tests.` at `mod.rs:221`) — a
known-but-unfiled task living as four comment clones.

### Proposal

Two options, in preference order:

1. Do what the copy-pasted TODO asks: move the operator tests into the
   crate's integration tests (`nanvm-lib/tests/`), where a single support
   module owns `T`/`int`/`pos`/`neg`. This resolves the TODO comments and the
   helper duplication at once.
2. Interim: a `#[cfg(test)] mod test_util` under `vm/bigint/` exporting
   `T`/`int`/`pos`/`neg`, imported by each operator's `tests` module; the
   four TODO comments collapse to one at the shared module.

Either way, delete the per-file comment clones.

### Tasks

- [ ] Pick option 1 or 2; consolidate `T`/`int`/`pos`/`neg`/`TestBigInt`.
- [ ] Remove the duplicated TODO comments (the shared location keeps one, or
      option 1 deletes them all).
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [single-source-of-truth-for-operator-tests.md](./single-source-of-truth-for-operator-tests.md)
  — cross-language (JS proof vs Rust test) duplication; this issue is the
  intra-Rust helper duplication, a different site and mechanism.
