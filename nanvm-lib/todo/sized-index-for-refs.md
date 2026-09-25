## `SizedIndex` for references

**Priority:** P3
**Status:** open

### Problem

`IContainer`'s default `items_eq` (`src/vm/internal/icontainer.rs`)
hand-rolls an indexed loop:

```rust
for i in 0..len {
    if a[i] != b[i] { return false; }
}
```

`items_eq` is `Iter::eq_by_` (`src/common/iter.rs`) re-implemented — and at
`36c8d4a` `eq_by_` has no consumer in the crate or its tests at all, so the
crate's own container equality does not use the crate's own equality
combinator.

The blocker is structural: `SizedIndex::index_iter`
(`src/common/sized_index.rs`) takes `self` by value and requires
`Self: Sized`, while `IContainer::items()` returns `&Self::Items` with
`Items: ?Sized`. The one iteration abstraction the crate has is unreachable
from the one accessor that returns items, so every consumer falls back to
`0..len` indexing: `items_eq`, `ContainerFmt::container_fmt`, and
`Debug for BigInt`.

### Proposal

`impl<I: Uint, T: SizedIndex<I> + ?Sized> SizedIndex<I> for &T` (with the
matching `Index`), making `items()` directly iterable. Then `items_eq`
becomes header check plus
`a.index_iter().eq_by_(b.index_iter(), PartialEq::eq)`, and the debug/format
loops become `for item in items.index_iter()`. Also the missing piece that unblocks
[debug-delimited-fmt-helper](debug-delimited-fmt-helper.md) cleanly.

### Tasks

- [ ] Add the reference impls
- [ ] Convert `items_eq` and the debug/format loops

### Related

- [debug-delimited-fmt-helper](debug-delimited-fmt-helper.md) — the
  `Debug` site; this issue removes the indexing it was forced into
