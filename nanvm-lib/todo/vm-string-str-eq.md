## vm-string-str-eq. A property name is compared by building a VM string first

**Priority:** P4
**Status:** open

### Problem

Every place the VM asks whether a key is a particular built-in name
converts the literal into a VM value to ask it:

```rust
// vm/lambda/method.rs
if *key == "toString".into() {
if *key == "at".into() {
// vm/array/member_access.rs, and the same line in vm/string/member_access.rs
if s == "length".into() {
// vm/function/member_access.rs
Unpacked::String(s) if s == "length".into() => …
```

`"x".into()` allocates a UTF-16 container and wraps it in an `Any`, and
`method` runs on every call whose receiver has no own property of that
name, and again in the optional-call guard. As
[member-functions](./member-functions.md) fills in the built-in table,
each new name is one more allocate-and-compare on every lookup. The name
`"length"` is also spelled three times with the same answer,
`Number::from(len).to_any()`.

"Does this VM string equal this Rust literal" is a primitive the crate
does not have, so each site improvises it.

### Proposal

```rust
impl<A: IVm> PartialEq<str> for String<A>   // iterates self against other.encode_utf16()
```

in `vm/string/partial_eq.rs`, and a `Any::is_str(&self, &str) -> bool`
for `method`, which needs the unpack first. The built-in method table
then becomes a `(&'static str, Method<A>)` slice, and `"length"` one
constant shared by the three `member_access` files.

### Tasks

- [ ] `PartialEq<str> for String<A>` and `Any::is_str`, with tests.
- [ ] The five sites through them; one `LENGTH` name.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [indexed-member-access-skeleton](./indexed-member-access-skeleton.md)
  — merges the Array and String `member_access` bodies; the `"length"`
  arm is one of them.
- [string-cmp-iterator-cmp](./string-cmp-iterator-cmp.md) — ordering
  between two VM strings; this is equality against a literal.
