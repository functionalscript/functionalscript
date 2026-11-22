## L0's little-endian marshalling, written once

**Priority:** P3
**Status:** open

### Problem

The L0 ABI moves strings as UTF-16 units and bigints as 64-bit words,
both little-endian, through linear memory. Each direction is written
once per width, in two crates.

In [`src/l0/abi.rs`](../src/l0/abi.rs), `load_units` and `load_words`
are one body with `2`/`u16` and `8`/`u64`:

```rust
let r = bytes(name, ptr, len, 2);
with(|s| s.memory[r].as_chunks::<2>().0.iter().map(|&c| u16::from_le_bytes(c)).collect())
```

and `read_units` and `read_words` are one body the same way.

[`nanvm/l0-wasm/src/lib.rs`](../../l0-wasm/src/lib.rs) repeats them
over its own memory — `make_string`, `make_bigint`, `read_units`,
`read_words` — and `trap_text_into` is one more copy of the encode loop.

The bounds arithmetic is in both crates too: `bytes` in `abi.rs` and
`region` in `l0-wasm` each compute `start`, `len.checked_mul(size)` and
`start.checked_add(n)` and trap with `out of bounds`. In `region` that
range guards an `unsafe { from_raw_parts_mut }`, so the copy is of a
safety check.

### Proposal

A sealed trait in `nanvm_lib::l0::abi`, implemented for `u16` and `u64`,
that carries the width and the two chunk conversions
([AGENTS.md §2.1](../AGENTS.md)'s first option, a trait and not a macro);
two generic functions over it, `load<T>(&[u8]) -> Vec<T>` and
`store<T>(&[T], &mut [u8])`; and one exported
`span(ptr, len, size) -> Option<Range<usize>>`.

`abi.rs` then has one `load` and one `read`, and `l0-wasm` calls the
same generics on the slice `region` gives it.

### Drawbacks

- `l0-wasm` is `#![cfg(target_arch = "wasm32")]`: a native `cargo test`
  does not compile it, so the change is verified only by the wasm build.
- `make_string_of`, `read_units_into`, `make_bigint_of` and
  `read_words_into` are what `abi/test.rs` and `abi/native/test.rs`
  call. Keeping them as thin wrappers is cheaper than moving the tests.

### Related

- [string units](./string-units.md)
- `l0-wasm` also hand-copies the `fjs:l1-native` rows that
  [`fjs/ir/native`](../../../fjs/ir/native/module.f.js) holds as a
  table. [`fjs/nanvm/commands`](../../../fjs/nanvm/commands) printing
  `gen.commands.rs` is the precedent for generating such a list, and
  [generated shared constants](../../effects-node/todo/generated-shared-constants.md)
  asks the same of the limits and codes.
