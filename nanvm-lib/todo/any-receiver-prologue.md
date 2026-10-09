## any-receiver-prologue. `Member` and `Any::entry` repeat the receiver guard and fallback

**Priority:** P4
**Status:** open

### Problem

The two receiver reads open the same way and fall back the same way —
`Any::entry`, the `entry` helper's read, and the `.` node's step,
`Member::new` guarding the receiver for `Member::read` in
`vm/lambda/member.rs`:

```rust
// vm/any/mod.rs, Any::entry
let unpacked: Unpacked<A> = self.into();
if unpacked.is_nullish() {
    return Err(error::nullish_to_object());
}
let key = key.to_string()?;
Ok(match unpacked {
    Unpacked::Object(o) => o.own_property(&key),
    Unpacked::Array(a) => a.entry(&key),
    Unpacked::String(s) => s.entry(&key),
    _ => None,
}
.unwrap_or_else(Any::undefined))

// vm/lambda/member.rs, Member::new — the guard, at the `.` node
if receiver.is_nullish() {
    return Err(error::nullish_to_object());
}
// vm/lambda/member.rs, Member::read — the fallback, at the exit, over
// Member::own's match on the receiver
self.own().unwrap_or_else(Any::undefined)
```

Two policies are stated here, and each is stated by repetition rather than
by name. **A nullish receiver throws before the key is looked at** — the
`ToObject`-first ordering that `Any::entry`'s doc and its
`entry_nullish_receiver_outranks_the_key` test pin down.
**An absent member reads `undefined`** — the `unwrap_or_else` each read
ends in. The predicate and the value are named (`is_nullish`,
`Any::undefined`); the policies that use them are not. The doc comments
assert that the operators agree on both ("the same fallback `Any::entry`
has"); nothing in the code makes them agree, and the next receiver
operator re-follows the convention by hand or drifts.

### Proposal

Two private helpers, plain functions, shared by `vm/any` and `vm/lambda`:

```rust
/// The receiver unpacked, or the `TypeError` a nullish receiver throws —
/// before any key handling, as `ToObject` runs before `ToPropertyKey`.
fn non_nullish_receiver<A: IVm>(v: Any<A>) -> Result<Unpacked<A>, Any<A>>
/// The property read, `undefined` where the receiver has no such member.
fn undefined_if_absent<A: IVm>(v: Option<Any<A>>) -> Any<A>
```

Each read then opens with `non_nullish_receiver(self)?` — the `?` puts the
ordering in the control flow rather than in a comment — and closes with
`undefined_if_absent(…)`. `error::nullish_to_object` is then called in one
place.

### Tasks

- [ ] Add the two helpers; rewrite both reads through them, doc comments
      trimmed to point at the helpers instead of each other.
- [ ] `cargo test` — the nullish-outranks-key test and the fallback tests
      pass unchanged; `cargo clippy`, `cargo fmt -- --check`.

### Related

- [`src/vm/error.rs`](../src/vm/error.rs) — the message side; this
  issue is the guard-and-fallback skeleton around it.
- [indexed-member-access-skeleton.md](./indexed-member-access-skeleton.md) —
  the same pair of operators one layer down.
