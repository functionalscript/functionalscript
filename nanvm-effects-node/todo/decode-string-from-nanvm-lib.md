## `decode_string` rebuilds a conversion `nanvm-lib` provides

**Priority:** P4
**Status:** open

### Problem

[`nanvm-lib`](../../nanvm-lib/src/vm/string/from.rs) implements
`From<String<A>> for std::string::String`, documented as lossy: a lone
surrogate becomes U+FFFD. The listed sites write the same conversion again,
collecting the code units into a `Vec<u16>` and calling
`String::from_utf16_lossy`:

- `decode_string` in [`codec.rs`](../src/codec.rs);
- `names` in the harness's [`parity.rs`](../../nanvm-harness/tests/parity.rs).

Both are lossy in the same way, so each is the library's conversion with an
intermediate vector and a `SizedIndex` import it does not need.

### Proposal

`decode_string` becomes `VmString::try_from(any)` followed by `.into()`,
keeping its "not a string" refusal; `names` becomes `key.into()` per
entry.

### Tasks

- [ ] The listed sites onto the `From` impl; `cargo test`, `cargo clippy`,
      `cargo fmt -- --check`.
