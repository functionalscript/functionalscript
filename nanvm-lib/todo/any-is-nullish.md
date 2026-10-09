## any-is-nullish. "Is this value nullish" is spelled six ways, one of them the way a doc warns against

**Priority:** P4
**Status:** wip

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
// vm/any/mod.rs, Any::entry
if let Unpacked::Nullish(_) = &unpacked {
// vm/any/nullish_coalescing.rs
Unpacked::Nullish(_) => rhs(),
// vm/array/join.rs, Array::join
.map(|v| match Nullish::try_from(v.clone()) {
    Ok(_) => Ok("".into()),
    Err(_) => v.to_string(),
})
```

The rule that matters — match on `Unpacked` rather than
`Nullish::try_from`, so the common case allocates no error value — is
stated in two doc comments and followed at five sites. The sixth, which
runs once per element whenever an array is joined into a string, is the
allocating form the docs warn against. A rule that lives in a comment on
a private impl is one the next site does not see.

The value `undefined` is likewise spelled `Nullish::Undefined.to_any()`
at some forty sites, and several test modules — `array/at`,
`array/includes`, `array/index_of`, `string/building`, `string/search`,
`lambda`, `any/dot` — each define a private `fn undefined()` for it.

### Proposal

`Any` owns both:

```rust
impl<A: IVm> Unpacked<A> {
    /// The one place the match is written.
    pub fn is_nullish(&self) -> bool
}
impl<A: IVm> Any<A> {
    /// Unpacks a clone and asks it; without building an error value, since the common answer is `false`.
    pub fn is_nullish(&self) -> bool
    pub fn undefined() -> Self
}
```

Two forms, because two of the sites already hold an `Unpacked`:
`Any::entry` converts `self` once and dispatches on the result, and
`Member::is_nullish` consumes what `own()` returned. Those ask the
`Unpacked` form and keep their single conversion; the others, which
hold an `Any` and nothing else, ask the `Any` form, which is the
`Unpacked` form over one unpack. The rationale moves to the docs, and
the test-local `undefined()` helpers are deleted.

### Tasks

- [ ] `Unpacked::is_nullish`, `Any::is_nullish` and `Any::undefined`,
      with tests.
- [ ] The six sites, `Array::join`'s among them, and the test helpers
      through them.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [any-receiver-prologue](./any-receiver-prologue.md) — the receiver
  guard in `Member::new` and `Any::entry` is two of these sites; a
  receiver-read layer would be built on this predicate.
- [primitive-to-any](./primitive-to-any.md) — the other missing
  conversion beside `undefined()`.
