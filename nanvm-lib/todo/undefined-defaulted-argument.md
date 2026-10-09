## undefined-defaulted-argument. "Use the default when the argument is `undefined`" is unpacked and matched at a dozen sites

**Priority:** P4
**Status:** open

### Problem

Many built-ins take an optional argument whose absence selects a default:
`slice`'s `end` (one site, `relative_range` in `vm/position.rs`, for
both `Array` and `String`), `substring`'s and `pad`'s,
`split`'s limit, `ends_with`'s position, `to_sorted`'s comparator,
`array_flat`'s depth, `array_join`'s separator, `radix`, `digits`. Each
spells the test the same
way — unpack a clone, match the one variant — and two files went as far
as a private predicate for it:

```rust
// vm/string/building.rs, is_undefined
fn is_undefined<A: IVm>(v: &Any<A>) -> bool {
    matches!(Unpacked::from(v.clone()), Unpacked::Nullish(Nullish::Undefined))
}
// vm/string/patterns.rs, String::split — the same predicate as a closure
let is_undefined = |v: &Any<A>| {
    matches!(Unpacked::from(v.clone()), Unpacked::Nullish(Nullish::Undefined))
};
```

The others write the match inline, with the default on one side and the
conversion on the other:

```rust
// vm/lambda/number.rs, digits
if matches!(Unpacked::from(v.clone()), Unpacked::Nullish(Nullish::Undefined)) {
    return Ok(None);
}
Ok(Some(v.to_integer_or_infinity()?))
// vm/lambda/method.rs, array_flat
let depth = match Unpacked::from(depth.clone()) {
    Unpacked::Nullish(Nullish::Undefined) => 1.0,
    _ => depth.to_integer_or_infinity()?,
};
```

The sibling test, "is this `null` or `undefined`", is `Unpacked::is_nullish`
and `Any::is_nullish` (`vm/unpacked.rs`, `vm/any/mod.rs`), beside the
`Any::undefined()` constructor. None of the sites above are nullish tests:
`null` is converted there, as the specification says, and only `undefined`
takes the default. So those leave every one of these in place.

### Proposal

`Any` owns the question once, as an `Option`:

```rust
impl<A: IVm> Unpacked<A> {
    pub fn is_undefined(&self) -> bool
}
impl<A: IVm> Any<A> {
    /// `None` for `undefined`, `Some(self)` for every other value: the
    /// argument an optional parameter was passed, if it was passed one.
    pub fn defined(self) -> Option<Self>
}
```

Each site then reads as the rule it implements — the default, or the
conversion of what is there:

```rust
let to = end.defined().map_or(Ok(len), |e| Ok(clamped(relative(e, len)?, len)))?;
v.defined().map(|v| v.to_integer_or_infinity()).transpose()
```

The two private predicates are deleted. Build `defined` on the same
`Unpacked` match as `is_nullish`, so the rule its doc states — match
on `Unpacked`, never `Nullish::try_from`, so the common case allocates
no error — is followed by both.

### Tasks

- [ ] `Unpacked::is_undefined` and `Any::defined`, with tests.
- [ ] The sites above through `defined`; `is_undefined` in
      `vm/string/building.rs` and the closure in `String::split` deleted.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`src/vm/position.rs`](../src/vm/position.rs) — the position readers
  that take the default most often; `relative_range` there is one of
  these sites.
