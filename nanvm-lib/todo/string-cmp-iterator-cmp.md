## string-cmp-iterator-cmp. `String::cmp` hand-rolls `Iterator::cmp`

**Priority:** P5
**Status:** open

### Problem

`Ord for String<A>` in `vm/string/cmp.rs` walks two code-unit iterators by
hand:

```rust
// Ord::cmp for String<A>
let mut a = self.clone().index_iter();
let mut b = other.clone().index_iter();
loop {
    return match (a.next(), b.next()) {
        (Some(x), Some(y)) => match x.cmp(&y) {
            Ordering::Equal => continue,
            order => order,
        },
        (Some(_), None) => Ordering::Greater,
        (None, Some(_)) => Ordering::Less,
        (None, None) => Ordering::Equal,
    };
}
```

That is `Iterator::cmp`'s contract exactly — lexicographic, shorter prefix
first — over `u16`, which is `Ord`. The `loop { return match … continue }`
shape reads as a loop but returns on the first iteration in every arm but
one. `common/iter.rs` keeps `eq_by_` because std's `eq_by` is unstable, and
says so; `Iterator::cmp` has been stable since Rust 1.5 and has no such
excuse.

### Proposal

```rust
fn cmp(&self, other: &Self) -> Ordering {
    self.clone().index_iter().cmp(other.clone().index_iter())
}
```

`Iterator::cmp` takes an `IntoIterator`, and `String<A>` already implements
it (`vm/impls/into_iterator.rs`), so `.cmp(other.clone())` is shorter
still. The doc comment on the impl block — UTF-16 code-unit order, not
codepoint-aware — stays as the statement of the rule.

### Tasks

- [ ] Replace the loop; the four existing tests pass unchanged.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [zip-longest.md](./zip-longest.md) — the dual-sequence walks that *do*
  need a combinator, all in `bigint` and `common/iter.rs`; this one needs
  only std.
