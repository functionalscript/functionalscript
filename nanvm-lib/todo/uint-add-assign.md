## uint-add-assign. `index_iter` restates `Uint`'s bounds by hand because `Uint` is missing `AddAssign`

**Priority:** P4
**Status:** open

### Problem

`src/common/uint.rs:3` owns the index-type bound:

```rust
pub trait Uint: Sized + Copy + Default + PartialEq + Sub<Output = Self> + From<u8> {}
```

`src/common/index_iter.rs` uses it at `:10`
(`impl<I: Uint, T: SizedIndex<I>> IndexIter<I, T>`) — and then, nine lines
later on the same struct, re-lists all the bounds by hand plus one more:

```rust
// index_iter.rs:19-22
impl<
    I: Copy + Default + PartialEq + AddAssign + From<u8> + Sub<Output = I>,
    T: SizedIndex<I, Output: Clone>,
> Iterator for IndexIter<I, T>
```

Two spellings of one bound in one file, guaranteed to drift. The extra
`AddAssign` is the load-bearing part: because `Uint` does not carry it,
`SizedIndex::index_iter` (`src/common/sized_index.rs:17-22`) is constrained
only by `I: Uint` and can hand back an `IndexIter` that is not an `Iterator` —
the crate's iteration entry point does not guarantee the thing it returns
iterates.

### Proposal

Stepping by one is part of what "index type" means; put `AddAssign` in the
owner:

```rust
pub trait Uint:
    Sized + Copy + Default + PartialEq + AddAssign + Sub<Output = Self> + From<u8> {}
```

(and the mirroring blanket impl), then:

```rust
impl<I: Uint, T: SizedIndex<I, Output: Clone>> Iterator for IndexIter<I, T>
```

### Tasks

- [ ] Add `AddAssign` to `Uint` and its blanket impl; rewrite the `Iterator`
      impl's bounds as `I: Uint`.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [sized-index-for-refs](./sized-index-for-refs.md) — adjacent `SizedIndex`
  API work.
