## Let a VM share string slices

**Priority:** P4
**Status:** open

### Problem

Every `nanvm` operation that produces a string from part of another one
builds a new container: `IContainer::new` from an iterator of code units.
Reading one character, `'abc'[1]`, allocates a one-unit string, and
`slice`, `substring` and `at` copy their range.
[Spread operations](./spread-operations.md) add one more such case:
`get_iterator` over a string yields each code point as a new `String`, so
`[...s]` allocates once per code point.

That is correct, since JavaScript strings are values and a copy is
indistinguishable from a share. It is a cost, though, and two parts of the
design decide where that cost belongs.

### The Naive VM stays naive

[`naive`](../src/naive/mod.rs) is the plain reference implementation of
`IVm`, simple on purpose: each container owns its items, and every new
string is a copy. It is not where speed is won, and this issue does not
change it. A faster VM, a NaN-boxing one for example, is a different
implementation of the same traits, and sharing a buffer is that VM's
choice to make.

### The VM traits must let a VM share

What a VM may choose is fixed by the traits, and today they leave it no
choice. `IContainer` has one constructor, `new`, which takes an iterator of
items. A part of a string can only be built item by item, so even a VM
that could share its parent's buffer is handed the items one at a time and
has to copy them.

The proposal: one constructor for a part of an existing container, with
the copy as its default.

```rust
/// The items of `self` in `range`, under the same header: a copy by
/// default, which a VM may override to share `self`'s buffer.
fn slice(&self, range: Range<usize>) -> Self {
    Self::new_ok(self.header().clone(), range.map(|i| self.items()[i].clone()))
}
```

The Naive VM keeps the default. A VM that stores a buffer, an offset and a
length overrides it to share. `items()` already returns `&Self::Items`, an
indexed view rather than an owned buffer, so it can serve a slice's range
without changing its signature. Every operation that produces part of a
string then calls `slice`:

- `at` and `charAt`, through `String::of_unit`, and a string read by index,
  which builds the same one-unit string by hand in `member_access` today;
- `slice` and `substring`;
- `trim`, `trimStart` and `trimEnd`, which keep a range of the string;
- each piece `split` produces;
- each code point `get_iterator` yields.

A new operation that produces part of a string joins this list.
`concat`, `repeat`, `padStart` and `padEnd` build strings that are not one
range of a single source, and `toWellFormed` replaces units, so none of them
is a slice.

That is one place for a VM to make the choice, instead of one per operation.

Questions for the investigation:

- **What a share retains.** A short slice of a long string keeps the whole
  parent alive. A sharing VM decides when to copy instead, by a size
  threshold or otherwise. The trait only permits sharing; it never
  requires it.
- **What must not change.** Equality, ordering and hashing stay by
  content, never by buffer identity. A content-addressed VM must hash a
  slice and its copy the same way. `items_eq` already compares items, not
  buffers.
- **Whether arrays want the same.** `slice`, `toSpliced` and the other
  array built-ins copy ranges too. `IContainer` is shared by strings,
  bigints, objects and arrays, so the one constructor serves all four.
  Whether an array VM would use it is that VM's question.
- **Whether a one-unit string wants its own path.** Indexed reads and a
  code-point walk over most text produce one-unit strings. `String::of_unit`
  builds them for `at` and `charAt`; the indexed read should use it too, so
  there is one place. A VM may serve these from a table of the 65,536
  possible ones rather than from a slice.

### Tasks

- [ ] `IContainer::slice` with the copying default, and the string
      operations above built through it. Naive's output is unchanged.
- [ ] Measure a sharing prototype against the copy, on a long string
      spread, an indexed read in a loop, and `slice`-heavy code such as the
      repository's parsers compiled to Rust. Record the numbers, pinned to a
      commit.
- [ ] Decide whether a sharing VM is worth building, and file it as its
      own issue, or close this with the numbers that say it is not.

### Related

- [spread-operations](./spread-operations.md): `get_iterator` yields a new
  `String` per code point, as JavaScript does.
- [member-functions](./member-functions.md): `at`, `slice` and the other
  built-ins that produce strings.
- [optimal-nanvm](./optimal-nanvm.md): the faster VM's representation
  choices.
- [`vm/internal/icontainer.rs`](../src/vm/internal/icontainer.rs): the
  trait the constructor joins.
