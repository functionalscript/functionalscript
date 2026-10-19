## `IteratorRecord` and `ObjectSpread` hand-roll the cursor `IndexIter` is

**Priority:** P4
**Status:** open

### Problem

`common/index_iter.rs`'s `IndexIter<I, T>` is the index cursor over a
`SizedIndex` container, and `Array`, `Object` and `String` iterate through it
in `vm/impls/into_iterator.rs`. `IteratorRecord::Array { array, next }` in
`vm/iterator_record.rs` and `ObjectSpread::Array` and `ObjectSpread::String`
in `vm/object_spread.rs` keep their own `next: u32` and write the bounds
check and the step again, once per variant, each with its own `size_hint` from
`length().saturating_sub(*next)` — a hint `IndexIter` does not implement, so
`Array::into_iter()` gives none where the hand copies do.

```rust
// iterator_record.rs
IteratorRecord::Array { array, next } => {
    if *next >= array.length() { return None; }
    let value = array[*next].clone();
    *next += 1;
    Some(value)
}
// common/index_iter.rs
fn next(&mut self) -> Option<Self::Item> {
    let i = self.i;
    if i == self.container.length() { return None; }
    self.i += 1.into();
    Some(self.container[i].clone())
}
```

### Proposal

`IndexIter` gets an exact `size_hint`, `ExactSizeIterator` and
`FusedIterator`. Both are promises that the length holds still — an exact
hint, no item after `None` — and `size_hint` belongs to the one blanket
`impl Iterator for IndexIter<I, T: SizedIndex<I>>`, which Rust will not let
a narrower impl override, so the promise has to be the trait's. It can be:
`SizedIndex`'s implementors are `[T]`, immutable through the shared borrow
that reaches it, and the `ContainerWrapper`s, the VM's immutable
containers, so a fixed length is what every `SizedIndex` already has and
only the trait's doc leaves unsaid. The proposal states it on `SizedIndex`
— a `length` that does not change for as long as the container is held —
and the one blanket impl then carries the exact hint and both marker
traits for every implementor; a container with interior mutability would
have to decline the trait, which nothing in the tree is. The hint is a
`usize`, and `Uint` — `Copy`, `Default`, `PartialEq`, `AddAssign`, `Sub`,
`From<u8>`, a blanket impl over whatever has them — converts to nothing, so
`length() - i` has no way into a `usize` but counting. `Uint` gains the
conversion, `Into<usize>`, which `u32` and `usize`, the two indices the
tree uses, have, and the hint is `(self.container.length() - self.i).into()`.
`IteratorRecord::Array`
holds an `IndexIter<u32, Array<A>>`,
and the two `ObjectSpread` variants an `Enumerate<IndexIter<…>>` mapped
through `index_key` and `String::of_unit`. Only the code-point walk of
`IteratorRecord::String`, which steps by one or two, stays hand-written.
[spread-operations](./spread-operations.md) documents the `{ array, next }`
shape as shipped; this changes two variants' fields, not what they answer.

### Tasks

- [ ] A fixed length stated as `SizedIndex`'s contract and `Into<usize>` on
      `Uint`; `size_hint`, `ExactSizeIterator` and `FusedIterator` on
      `IndexIter`'s one impl.
- [ ] `IteratorRecord::Array`, `ObjectSpread::Array` and
      `ObjectSpread::String` over it; spread-operations updated.

### Related

- [spread-operations](./spread-operations.md) — the enums' shape.
- [sized-index-for-refs](./sized-index-for-refs.md) — iterating `&Items`
  inside `IContainer`, a different cursor.
