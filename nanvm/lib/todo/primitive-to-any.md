## primitive-to-any. No `Primitive` → `Any` conversion, so six sites spell the round trip

**Priority:** P4
**Status:** open

### Problem

`vm/primitive.rs` converts a `Primitive<A>` into an `Unpacked<A>` and stops
one hop short of `Any<A>`. Every site that needs an `Any` back out of a
primitive writes the two hops itself:

```rust
// vm/any/add.rs, Add for Any<A> — written twice, once per branch
let lhs: Any<A> = Unpacked::from(lhs).into();
let rhs: Any<A> = Unpacked::from(rhs).into();

// vm/any/relational.rs, primitive_to_numeric
let any: Any<A> = Unpacked::from(other).into();

// vm/any/mod.rs, Any::to_numeric
let u: Unpacked<A> = prim_value.into();
let any: Any<A> = u.into();
```

Three spellings of one conversion. In `add.rs` the pair is also written
once inside the string branch and again after it, where one pair above the
`if` would do — the `matches!` guard needs only a borrow.

### Proposal

The missing impl, beside the one that exists:

```rust
impl<A: IVm> From<Primitive<A>> for Any<A> {
    fn from(v: Primitive<A>) -> Self {
        Unpacked::from(v).into()
    }
}
```

Two local types, so there is no coherence question and no macro. Every site
becomes `let lhs: Any<A> = lhs.into();`, and `add.rs` hoists its one pair
above the branch. [numeric-coercion-module.md](./numeric-coercion-module.md)
plans to delete the round trip inside `to_numeric` and
`primitive_to_numeric` by dispatching on the primitive directly; the arms
it does not short-circuit, and `add.rs`, still want a named conversion, so
this lands first and makes that issue smaller rather than competing with it.

### Tasks

- [ ] `From<Primitive<A>> for Any<A>` in `vm/primitive.rs`.
- [ ] Rewrite the sites in `add.rs`, `relational.rs` and `mod.rs`; hoist
      `add.rs`'s pair.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [numeric-coercion-module.md](./numeric-coercion-module.md) — removes two
  of the six sites for a different reason; the other four stay.
- [65y-nanvm-conversion-macros.md](./65y-nanvm-conversion-macros.md) — the
  `From`/`TryFrom` families on the `Unpacked` axis; `Primitive` is not on
  its list.
