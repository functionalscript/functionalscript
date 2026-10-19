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
`FusedIterator` — for the VM's containers, `IndexIter<u32, W>` with `W:
ContainerWrapper`, not for every `SizedIndex`: `length` is a method on a
trait that `[T]` implements too and that promises nothing about the length
holding still, and both traits are promises about it, an exact hint and no
item after `None`. The VM's containers are immutable, so for them the
promise is kept by construction, and the three hand copies live over them
alone. `IteratorRecord::Array` holds an `IndexIter<u32, Array<A>>`,
and the two `ObjectSpread` variants an `Enumerate<IndexIter<…>>` mapped
through `index_key` and `String::of_unit`. Only the code-point walk of
`IteratorRecord::String`, which steps by one or two, stays hand-written.
[spread-operations](./spread-operations.md) documents the `{ array, next }`
shape as shipped; this changes two variants' fields, not what they answer.

### Tasks

- [ ] `size_hint`, `ExactSizeIterator` and `FusedIterator` on `IndexIter`
      over a `ContainerWrapper`.
- [ ] `IteratorRecord::Array`, `ObjectSpread::Array` and
      `ObjectSpread::String` over it; spread-operations updated.

### Related

- [spread-operations](./spread-operations.md) — the enums' shape.
- [sized-index-for-refs](./sized-index-for-refs.md) — iterating `&Items`
  inside `IContainer`, a different cursor.
