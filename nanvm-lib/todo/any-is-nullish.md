## any-is-nullish. "Is this value nullish" is spelled six ways, one of them the way a doc warns against

**Priority:** P4
**Status:** open

### Problem

The VM decides whether an `Any` is `null` or `undefined` at six sites,
none through a named predicate:

```rust
// vm/lambda/mod.rs, Live for Any — with a doc explaining the choice
matches!(Unpacked::from(self.clone()), Unpacked::Nullish(_))
// vm/lambda/member.rs, Member::is_nullish
Some(v) => matches!(Unpacked::from(v), Unpacked::Nullish(_)),
// vm/lambda/member.rs, Member::new
if let Unpacked::Nullish(_) = Unpacked::from(receiver.clone()) {
// vm/any/mod.rs, own_property
if let Unpacked::Nullish(_) = &unpacked {
// vm/any/nullish_coalescing.rs
Unpacked::Nullish(_) => rhs(),
// vm/primitive_coercion.rs, arr_element_to_string
Nullish::try_from(v.clone()).map(|_| Ok("".into())).unwrap_or_else(|_| v.to_string())
```

The rule that matters — match on `Unpacked` rather than
`Nullish::try_from`, so the common case allocates no error value — is
stated in two doc comments and followed at five sites. The sixth, which
runs once per element whenever an array is joined into a string, is the
allocating form the docs warn against. A rule that lives in a comment on
a private impl is one the next site does not see.

The value `undefined` is likewise spelled `Nullish::Undefined.to_any()`
at about two dozen sites, and three test modules each define a private
`fn undefined()` for it.

### Proposal

`Any` owns both:

```rust
impl<A: IVm> Any<A> {
    /// Without building an error value: the common answer is `false`.
    pub fn is_nullish(&self) -> bool
    pub fn undefined() -> Self
}
```

The six sites call `is_nullish`, the rationale moves to its doc, and the
test-local `undefined()` helpers are deleted.

### Tasks

- [ ] `Any::is_nullish` and `Any::undefined`, with tests.
- [ ] The six sites and the test helpers through them.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [any-receiver-prologue](./any-receiver-prologue.md) — the receiver
  guard in `Member::new` and `own_property` is two of these sites; a
  receiver-read layer would be built on this predicate.
- [primitive-to-any](./primitive-to-any.md) — the other missing
  conversion beside `undefined()`.
