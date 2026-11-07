## `String::units` is private and re-spelled

**Priority:** P5
**Status:** open

### Problem

`units(from, to)` in [`vm/string/building.rs`](../src/vm/string/building.rs),
the string of a range of code units, is private to that file. `split` in
[`vm/string/patterns.rs`](../src/vm/string/patterns.rs) writes it again as
`piece`, and `substring` in [`l0/mod.rs`](../src/l0/mod.rs) a third time,
`(start..end).map(|i| s[i]).to_string().to_any()`; `l0::concat` likewise
re-spells `impl Add for String<A>`.

### Proposal

`units` as a `pub(crate)` method over a `Range<u32>` beside `unit_at` in
`vm/string/code_unit.rs`, used by `slice`, `substring`, `trim`, `split` and
`l0::substring`; `l0::concat` adds the two strings. It is the one method a
slice-sharing VM would later hook.

### Tasks

- [ ] `units` shared; the copies over it.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [string-slices](./string-slices.md) — `IContainer::slice`, which this
  is the `String<A>`-level step toward; it lists the same callers.
