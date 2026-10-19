## The temp-directory guard is copied, and skipped where it is not

**Priority:** P4
**Status:** open

### Problem

`files.rs` and `resolve.rs` each define, inside their tests, `struct
Scratch(PathBuf)` with a `Drop` that removes the directory, differing only in
the name prefix. The four `*_through_perform` tests in `native.rs` build a
temp directory by hand and end with `remove_dir_all(&dir).unwrap()`, which a
failed assertion skips, so a red run leaves its directory behind. `native.rs`
also redefines a `member` closure in several tests and `members` once, where
`codec::member` is `pub` in the same crate.

### Proposal

One `#[cfg(test)] pub(crate) mod scratch` with the guard, used by `files.rs`,
`resolve.rs` and the four `native.rs` tests; `native.rs` reads members through
`codec::member`.

### Tasks

- [ ] The `scratch` module; the copies and the hand-built directories go.
- [ ] `native.rs` through `codec::member`.

### Related

- [parity-test-scaffolding](../../harness/todo/parity-test-scaffolding.md) —
  the harness's copy of the same guard.
- [io-error-constructors](./io-error-constructors.md) — the other small
  duplication in `files.rs`.
