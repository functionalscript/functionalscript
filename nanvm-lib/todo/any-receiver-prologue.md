## any-receiver-prologue. `Any::member_access` and `Any::own_property` repeat the receiver guard and fallback

**Priority:** P4
**Status:** open

### Problem

The two receiver operators on `Any` open the same way and fall back the same
way:

```rust
// vm/any/mod.rs, Any::own_property
let unpacked: Unpacked<A> = self.into();
if let Unpacked::Nullish(_) = &unpacked {
    return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
}
let key: String<A> = key.try_into()?;
Ok(match unpacked {
    Unpacked::Object(o) => o.own_property(&key).unwrap_or_else(|| Nullish::Undefined.to_any()),
    _ => Nullish::Undefined.to_any(),
})

// vm/any/member_access.rs, Any::member_access
let unpacked: Unpacked<A> = self.into();
if let Unpacked::Nullish(_) = &unpacked {
    return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
}
Ok(match unpacked {
    Unpacked::Array(a) => a.member_access(key).unwrap_or_else(|| Nullish::Undefined.to_any()),
    Unpacked::String(s) => s.member_access(key).unwrap_or_else(|| Nullish::Undefined.to_any()),
    Unpacked::Object(o) => o.member_access(key).unwrap_or_else(|| Nullish::Undefined.to_any()),
    _ => Nullish::Undefined.to_any(),
})
```

Two policies are stated here, and each is stated by repetition rather than
by name. **A nullish receiver throws before the key is looked at** — the
`ToObject`-first ordering that `own_property`'s doc and its
`own_property_nullish_receiver_outranks_non_string_key` test pin down.
**An absent member reads `undefined`** — the `unwrap_or_else` that appears
four times. The two doc comments assert that the operators agree on both
("the same fallback `own_property` has", "the same split `own_property`
has"); nothing in the code makes them agree, and the next receiver
operator re-follows the convention by hand or drifts.

### Proposal

Two private helpers in `vm/any/`, plain functions:

```rust
/// The receiver unpacked, or the `TypeError` a nullish receiver throws —
/// before any key handling, as `ToObject` runs before `ToPropertyKey`.
fn non_nullish_receiver<A: IVm>(v: Any<A>) -> Result<Unpacked<A>, Any<A>>
/// The property read, `undefined` where the receiver has no such member.
fn undefined_if_absent<A: IVm>(v: Option<Any<A>>) -> Any<A>
```

Each operator then opens with `let unpacked = non_nullish_receiver(self)?;`
— the `?` puts the ordering in the control flow rather than in a comment —
and every arm is `undefined_if_absent(x.member_access(key))`. The
`CANNOT_CONVERT_NULLISH_TO_OBJECT` constant is read in one place, which is
also what [error-constructors.md](./error-constructors.md) will want when
the thrown-value vocabulary moves.

### Tasks

- [ ] Add the two helpers; rewrite both operators through them, doc comments
      trimmed to point at the helpers instead of each other.
- [ ] `cargo test` — the nullish-outranks-key test and the fallback tests
      pass unchanged; `cargo clippy`, `cargo fmt -- --check`.

### Related

- [error-constructors.md](./error-constructors.md) — the message side; this
  issue is the guard-and-fallback skeleton around it.
- [indexed-member-access-skeleton.md](./indexed-member-access-skeleton.md) —
  the same pair of operators one layer down.
