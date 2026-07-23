## string-utf16-from-impls. Move UTF-16 string conversions out of `impls/from.rs`

**Priority:** P4
**Status:** open

### Problem

`vm/impls/from.rs` is the grab-bag of `From` impls for the `Unpacked`/`Any`
wrapping conversions, but two of its impls are string-domain logic — UTF-16
encode/decode between `String<A>` and Rust strings (`from.rs:27-40`):

```rust
impl<A: IVm> From<&str> for String<A> {
    fn from(value: &str) -> Self { value.encode_utf16().to_string() }
}
// TODO: Should we use `TryFrom` instead since we can have an error?
impl<A: IVm> From<String<A>> for std::string::String {
    fn from(value: String<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }
}
```

The lossy-decode policy (`REPLACEMENT_CHARACTER`) and the open `TryFrom`
question are string-conversion concerns; `vm/string/` already owns the
u16-side logic (`to_string.rs` with `ToString`/`try_to_string`, `index.rs`,
…) but has no conversion file. Separation of concerns: this is a move, and a
single consumer is enough justification per AGENTS.md.

### Proposal

Move both impls (and `From<&str> for Any<A>` at `from.rs:20-25`, which is
just `String::from` + `to_any`, if it reads better next to them) into a new
`vm/string/from.rs` (or fold into `to_string.rs`). `impls/from.rs` then
holds only `Unpacked`/`Any` variant wrapping — the set
[65Y-nanvm-conversion-macros](./65y-nanvm-conversion-macros.md) plans to
collapse, which that cleanup gets cleaner by not having to step around the
string impls.

Resolve or re-file the `TryFrom` TODO while moving: either keep the lossy
`From` and document the replacement-character policy in its doc comment, or
switch to `TryFrom` and fix the call sites.

### Tasks

- [ ] Move the impls to `vm/string/`; register the module in
      `vm/string/mod.rs`; delete them from `impls/from.rs`.
- [ ] Settle the `TryFrom` TODO (document lossy policy or convert).
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [65Y-nanvm-conversion-macros](./65y-nanvm-conversion-macros.md) — wants
  `impls/from.rs` to be pure variant-wrapping boilerplate.
