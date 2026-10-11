## Name `Result<T, Any<A>>` once

**Priority:** P5
**Status:** open

### Problem

The VM's fallible operations already follow the `?` error-handling pattern:
`Any::to_number`, `to_string` and `to_numeric` in
[`src/vm/any/mod.rs`](../src/vm/any/mod.rs) return `Result<_, Any<A>>`, and
callers propagate with `?` — `to_number()?` in `src/vm/array/at.rs` and
`src/vm/any/relational.rs`. The error type is spelled out at every such
signature, dozens of times across `src/vm`.

The retired top-level issue 44 ("Follow `?` error handling pattern") also
sketched `type Result<T> = Result<T, Self>` on `Any`, so that a signature names
only its success type. The pattern landed; the alias did not. The sketch's own
form — an associated type with a default — is not stable Rust, so a
crate-level alias such as `type AnyResult<T, A> = Result<T, Any<A>>` is the
available spelling.

### Proposal

Decide whether the alias earns its place: it shortens signatures, but hides the
error type a reader otherwise sees at a glance. Adopt it everywhere or record
why not, and delete this issue either way.

### Tasks

- [ ] Decide: an alias, or the error type spelled out.
- [ ] If an alias, apply it across `src/vm` in one change.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`src/vm/any/mod.rs`](../src/vm/any/mod.rs) — the coercions that return
  `Result<_, Any<A>>`.
