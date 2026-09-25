## bigint-operator-test-scaffolding. Shared test helpers for the bigint operator modules

**Priority:** P4
**Status:** open

### Problem

Every bigint operator file redeclares the same inline unit-test scaffolding
in `nanvm-lib/src/vm/bigint/`:

- `type T = BigInt<Naive>` + `fn int(value: i64) -> T { value.into() }` —
  duplicated in the `tests` modules of `add.rs`, `sub.rs` and `mul.rs`.
- `type T` + `fn pos(items: Vec<u64>) -> T` / `fn neg(items: Vec<u64>) -> T`
  (both `T::unchecked_new(...)`) — duplicated in the `tests` modules of
  `shl.rs` and `shr.rs`.
- `mod.rs`'s `tests` module uses a parallel `type TestBigInt = BigInt<Naive>`,
  and `cmp.rs`'s declares the same `type TestBigInt = BigInt<Naive>` with the
  same `.into()` construction pattern in its tests.

The identical comment
`// TODO: The unit tests should not use \`naive\` or other VM implementations.
//       We should move these tests into integration tests.` is itself
copy-pasted above the `tests` modules of `add.rs`, `sub.rs` and `mul.rs` (and
as `// TODO: move these tests to integration tests.` in `mod.rs`) — a
known-but-unfiled task living as four comment clones.

### Proposal

Primary plan: a `#[cfg(test)] mod test_util` under `vm/bigint/` exporting
`T`/`int`/`pos`/`neg`, imported by each operator's `tests` module; the four
TODO comment clones collapse to one at the shared module.

The copy-pasted TODO's wish — move these tests to integration tests
(`nanvm-lib/tests/`) — cannot simply own these helpers: integration tests
compile as an external crate, and `pos`/`neg` are built on
`BigInt::unchecked_new`, which is private (`nanvm-lib/src/vm/bigint/mod.rs`)
— deliberately, since it can construct non-normalized values. Moving the
`unchecked_new`-based tests out therefore requires either widening that
constructor's visibility just for tests (a bad trade) or rebuilding the raw
multi-word operands through public API. Tests that only need `int` (public
`From<i64>`) can move; the `pos`/`neg` internal-representation tests should
stay in-crate with the shared helper. If the integration-test move is still
wanted for the rest, that partial split rides on top of this consolidation.

Either way, delete the per-file comment clones.

### Tasks

- [ ] Add `#[cfg(test)] mod test_util` with `T`/`int`/`pos`/`neg`; migrate
      the operator `tests` modules and `mod.rs`'s `TestBigInt` to it.
- [ ] Remove the duplicated TODO comments, keeping one at the shared module
      (re-scoped to the `From<i64>`-only tests that *can* move out).
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`nanvm-lib/tests/README.md`](../tests/README.md) — the shared operator test
  data, which removed the cross-language (JS proof vs Rust test) duplication;
  this issue is the intra-Rust helper duplication, a different site and
  mechanism.
