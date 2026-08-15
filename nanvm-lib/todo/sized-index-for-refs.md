## `SizedIndex` for references

**Priority:** P3
**Status:** open

### Problem

`IContainer`'s default bodies hand-roll indexed loops
(`src/vm/internal/icontainer.rs:40-49, 52-61`):

```rust
for i in 0..len {
    if a[i] != b[i] { return false; }
}
```

`items_eq` is `Iter::eq_by_` (`src/common/iter.rs:44-60`) re-implemented —
and `eq_by_`'s only consumer in the whole repo is `tests/test/main.rs:121`,
so the crate's own container equality does not use the crate's own equality
combinator.

The blocker is structural: `SizedIndex::index_iter`
(`src/common/sized_index.rs:17-22`) takes `self` by value and requires
`Self: Sized`, while `IContainer::items()` returns `&Self::Items` with
`Items: ?Sized`. The one iteration abstraction the crate has is unreachable
from the one accessor that returns items, so every consumer falls back to
`0..len` indexing: `icontainer.rs:40`, `container_fmt.rs:11`,
`function/debug.rs:11, 19`, `bigint/debug.rs:18-22`.

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

- [debug-delimited-fmt-helper](debug-delimited-fmt-helper.md) — the two
  `Debug` sites; this issue removes the indexing they were forced into
