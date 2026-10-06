## position-arguments-owner. String reads positions through `vm/array/relative`, and three modules check a position is in range

**Priority:** P4
**Status:** open

### Problem

A built-in that takes an index or a position reads it by one recipe —
`ToIntegerOrInfinity(ToNumber(x))` — and the recipe has no owner. It is
spelled as `f64::from(x.to_number()?.to_integer_or_infinity())` at about
six sites: `relative` in `vm/array/relative.rs`, `position` in
`vm/string/code_unit.rs`, `digits` in `vm/lambda/number.rs`, `radix` and
`array_flat` in `vm/lambda/method.rs`, `to_spliced` in
`vm/array/to_spliced.rs`. `String::last_index_of` in
`vm/string/search.rs` is not one of them: it reads `ToNumber` first and
maps `NaN` to the end before `ToIntegerOrInfinity`, which would read
`NaN` as zero, so that site keeps its own conversion and shares only
`clamped`.

The relative-position arithmetic does have an owner, and it is the wrong
one: `relative` and `clamped` live in `vm/array/relative.rs`, and
`vm/string`'s `reads.rs`, `building.rs` and `search.rs` import them from
`vm::array::relative`. A string module depends on the array module for
arithmetic that is about neither.

Two more steps of the same reading are written by hand at each consumer.
"Is this position inside the collection":

```rust
// vm/array/at.rs, Array::at
Ok(if (0.0..f64::from(self.length())).contains(&k) { self[k as u32].clone() } else { … })
// vm/array/with.rs, Array::with
if !(0.0..f64::from(len)).contains(&k) { return Err("RangeError: Invalid index".into()); }
// vm/string/code_unit.rs, String::unit_at
(0.0..f64::from(self.length())).contains(&k).then(|| self[k as u32])
```

and "the range `start..end` names, `end` defaulting to the length",
computed identically by `Array::slice` in `vm/array/slice.rs` and
`String::slice` in `vm/string/building.rs`:

```rust
let from = clamped(relative(start, len)?, len);
let to = if /* end is undefined */ { len } else { clamped(relative(end, len)?, len) };
```

The name `position` meanwhile means three things: `string::code_unit::position`
turns an `Any` into an `f64`, `lambda::method::position` turns an
`Option<u32>` into `-1` or the index, and `Array::position` is the
callback search.

### Proposal

One module, `vm/position.rs`, owns reading a position argument, from the
`Any` to the index a collection can use:

```rust
impl<A: IVm> Any<A> {
    /// `ToIntegerOrInfinity(ToNumber(self))`; the one throw is `ToNumber`'s.
    pub fn to_integer_or_infinity(self) -> Result<f64, Any<A>>
}
pub(crate) fn relative<A: IVm>(index: Any<A>, len: u32) -> Result<f64, Any<A>>
pub(crate) fn clamped(k: f64, len: u32) -> u32
/// The index `k` names, when it is inside `0..len`.
pub(crate) fn in_range(k: f64, len: u32) -> Option<u32>
/// `start..end` as `slice` reads them, `end` the length when `undefined`.
pub(crate) fn relative_range<A: IVm>(start: Any<A>, end: Any<A>, len: u32) -> Result<Range<u32>, Any<A>>
```

`relative` and `clamped` move there unchanged; `at`, `with`, `unit_at`
and both `slice`s become one line each on `in_range` and
`relative_range`; the six inline conversions call the method, and
`last_index_of` keeps its `NaN` rule. The
module also settles the name: `position` is what this module reads, and
the two helpers in `code_unit.rs` and `lambda/method.rs` are renamed for
what they do.

### Tasks

- [ ] `vm/position.rs` with `Any::to_integer_or_infinity`, `relative`,
      `clamped`, `in_range`, `relative_range`, and tests moved from
      `vm/array/relative.rs`.
- [ ] `Array::at`, `Array::with`, `Array::slice`, `String::slice`,
      `String::unit_at` and the six inline conversions through it,
      `last_index_of` left with its `NaN` rule;
      `vm/array/relative.rs` deleted.
- [ ] The two other `position`s renamed.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [undefined-defaulted-argument](./undefined-defaulted-argument.md) —
  `relative_range`'s `end` default is that predicate.
- [indexed-member-access-skeleton](./indexed-member-access-skeleton.md)
  — the element read behind `member_access`, not the argument readers
  here; the two skeletons meet at `in_range`.
- [string-slices](./string-slices.md) — sharing a slice's storage, not
  computing its range.
