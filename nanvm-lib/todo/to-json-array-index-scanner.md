## to-json-array-index-scanner. `to_json` rescans array-index keys `member_access` already scans

**Priority:** P4
**Status:** open

### Problem

`array_index_value` in `vm/any/to_json.rs` and `string_to_index` in
`vm/member_access.rs` state the same rule — non-empty, ASCII digits only,
no leading zero unless the key is exactly `"0"`, fits a `u32` — with two
implementations:

```rust
// to_json.rs, array_index_value
let units: std::vec::Vec<u16> = k.clone().into_iter().collect();
let zero = b'0' as u16;
if units == [zero] { return Some(0); }
if units.is_empty() || units[0] == zero
    || !units.iter().all(|&u| (zero..=b'9' as u16).contains(&u)) { return None; }
let digits: std::string::String = units.iter().map(|&u| (u as u8) as char).collect();
digits.parse::<u32>().ok().filter(|&n| n != u32::MAX)

// member_access.rs, string_to_index
let first = digit(s[0])?;
if len == 1 { return Some(first); }
if first == 0 { return None; }
let mut value = first;
for i in 1..len {
    value = value.checked_mul(10)?.checked_add(digit(s[i])?)?;
}
Some(value)
```

`array_index_value` adds one clause the other lacks — `n != u32::MAX`, the
spec's array-index carve-out — and pays two heap allocations and a `parse`
to say it, while `string_to_index`'s doc explains at length why it walks
the code units without allocating. The two disagree on exactly one key,
`"4294967295"`: a member for `member_access`, not an index for `to_json`.
That is correct — an element read and an own-key ordering are different
questions — but the difference is invisible from either file.

### Proposal

`string_to_index` is the scanner; `array_index_value` is that call plus
its one clause:

```rust
fn array_index_value<A: IVm>(k: &String<A>) -> Option<u32> {
    string_to_index(k).filter(|&n| n != u32::MAX)
}
```

The doc comment keeps only the carve-out and its citation; the digit and
leading-zero paragraph already lives on `string_to_index`. The `u32::MAX`
filter then reads as the *only* difference between the two notions of an
index, which is what it is.

### Tasks

- [ ] Rewrite `array_index_value` over `string_to_index`; `to_json`'s
      existing tests for key order pass unchanged.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [indexed-member-access-skeleton.md](./indexed-member-access-skeleton.md) —
  the other half of finishing `vm/member_access.rs` as the owner.
- [to-json-fjs-migration.md](./to-json-fjs-migration.md) — retires
  `to_json` eventually; this change is three tokens and holds until then.
