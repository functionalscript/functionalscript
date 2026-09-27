## ivm-generic-eq-debug. A type generic over `A: IVm` gets `PartialEq` and `Debug` three ways, and one of them does not work

**Priority:** P4
**Status:** open

### Problem

`Naive`, the one VM, is `#[derive(Clone)]` and nothing more. A standard
derive on a type generic over `A: IVm` bounds `A` itself, so

```rust
// vm/primitive.rs
#[derive(Debug, PartialEq, Clone)] pub enum Primitive<A: IVm>
// vm/numeric.rs
#[derive(Debug, PartialEq, Clone)] pub enum Numeric<A: IVm>
```

yield impls that `Primitive<Naive>` and `Numeric<Naive>` do not have.
Nothing calls them; they compile because nothing tries. The two types
that took the constraint seriously answered it by hand, each with an
eight-arm match: `PartialEq for Unpacked<A>` and `Debug for Unpacked<A>`
in `vm/impls/`. And `nanvm-harness`'s `RunError<A>` answers it a third
way, a four-arm `Debug` and a four-arm `PartialEq` of the same
`_ => false` shape, with no rule anywhere saying which of the three a new
`A`-generic type should copy.

### Proposal

One owner: `Primitive` and `Numeric` already convert into `Unpacked`, so
their `PartialEq` and `Debug` are that conversion followed by
`Unpacked`'s — one small generic helper over `T: Clone + Into<Unpacked<A>>`
serves both, and the derives that do not work go. The rule — derive
nothing over `A`; bound `Any<A>` and its wrappers — is written once
where both crates read it. `RunError` is `nanvm-harness`'s, and
`nanvm-lib/AGENTS.md` is scoped to `nanvm-lib/` today, so the rule goes
into the root `AGENTS.md`'s Rust section, or into `nanvm-lib/AGENTS.md`
once [document-nanvm-harness](../../nanvm-harness/todo/document-nanvm-harness.md)
makes that guide workspace-wide.

### Tasks

- [ ] Replace the two derives with impls through `Unpacked`; a test that
      `Primitive<Naive>` compares and prints.
- [ ] The rule where both crates read it.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [159-collapse-per-type-wrapper-traits](./159-collapse-per-type-wrapper-traits.md)
  — `PartialEq` on the wrapper newtypes; this is the sum types.
- [debug-delimited-fmt-helper](./debug-delimited-fmt-helper.md) — the
  container `Debug` loop; independent.
- [document-nanvm-harness](../../nanvm-harness/todo/document-nanvm-harness.md)
  — decides which Rust guide covers the harness, and so where this
  rule lives.
