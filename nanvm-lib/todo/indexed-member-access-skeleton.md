## indexed-member-access-skeleton. `Array` and `String` spell the same indexed read

**Priority:** P4
**Status:** open

### Problem

`Array::member_access` (`vm/array/member_access.rs`) and
`String::member_access` (`vm/string/member_access.rs`) are one function
with the element read swapped:

```rust
// Array::member_access                          // String::member_access
let len = self.length();                         let len = self.length();
match Unpacked::from(key) {                      match Unpacked::from(key) {
    Unpacked::Number(n) => canonical_index(n)        Unpacked::Number(n) => canonical_index(n)
        .filter(|&i| i < len)                            .filter(|&i| i < len)
        .map(|i| self[i].clone()),                       .map(|i| [self[i]].to_string::<A>().to_any()),
    Unpacked::String(s) => {                         Unpacked::String(s) => {
        if s == "length".into() {                        if s == "length".into() {
            Some(Number::from(len).to_any())                 Some(Number::from(len).to_any())
        } else {                                         } else {
            string_to_index(&s)                              string_to_index(&s)
                .filter(|&i| i < len)                            .filter(|&i| i < len)
                .map(|i| self[i].clone())                        .map(|i| [self[i]].to_string::<A>().to_any())
        }                                                }
    }                                                }
    _ => None,                                       _ => None,
}                                                }
```

The doc comments are the same paragraphs with the noun changed, and the two
`mod tests` blocks are clones down to the test names and the
`["01", "+0", "1.0", " 0", "-0", ""]` list of non-canonical keys. The
rule they both encode — a canonical in-range index reads an element,
`"length"` reads the length, nothing else is a member, and `.length` is
never reachable through a number — is one rule, and today a change to it
is two edits plus two test edits.

`vm/member_access.rs` was created for exactly this axis; its module doc says
the classification "lives once here rather than twice". It stopped at
`canonical_index` and `string_to_index`, so the bound check, the `"length"`
case, and the `Unpacked` match stayed duplicated above it.

### Proposal

Finish the move. One generic free function in `vm/member_access.rs`:

```rust
/// `container[key]` for an indexed receiver: an in-bounds index, given as a
/// `Number` or its canonical decimal string, is `read`; the string key
/// `"length"` is the length; every other key is `None`.
pub(crate) fn indexed_member_access<A: IVm, T: SizedIndex<u32>>(
    container: &T,
    key: Any<A>,
    read: impl FnOnce(&T, u32) -> Any<A>,
) -> Option<Any<A>>
```

`Array::member_access` is `indexed_member_access(self, key, |a, i| a[i].clone())`
and `String::member_access` is
`indexed_member_access(self, key, |s, i| [s[i]].to_string::<A>().to_any())`.
`FnOnce` is enough, since each path reads at most once. This is a plain
function over a trait the two types already implement, so the
`AGENTS.md` ladder for per-type boilerplate is not engaged and no macro
is wanted.

The shared rule set — canonical and non-canonical keys, `"length"` against a
numeric `length`, out of range — is then proven once, beside the helper,
against both receivers; the two per-type test modules keep only what
differs, which is the expected element.

### Tasks

- [ ] `indexed_member_access` in `vm/member_access.rs`; the two methods
      become one-line calls with their doc comments trimmed to what is
      type-specific.
- [ ] Move the shared cases into one test module beside the helper; keep a
      per-type test for the element read.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [to-json-array-index-scanner.md](./to-json-array-index-scanner.md) — the
  third place the canonical-index rule is spelled, in `to_json`.
- [159-collapse-per-type-wrapper-traits.md](./159-collapse-per-type-wrapper-traits.md) —
  the per-newtype trait-impl inventory; this is an inherent method and is
  not on its lists.
- [`../../fjs/js/array_index/todo/one-array-index-rule.md`](../../fjs/js/array_index/todo/one-array-index-rule.md) —
  the same rule's three JavaScript copies.
