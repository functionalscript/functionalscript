## `Display` and `to_radix_string` carry the same long division

**Priority:** P4
**Status:** open

### Problem

[`display.rs`](../src/vm/bigint/display.rs) divides a `BigInt`'s words by
`10¹⁹` until none is left, collecting remainders, trimming leading zero
words after each pass. [`radix.rs`](../src/vm/bigint/radix.rs)'s
`to_radix_string` does the same with the base `chunk(radix)` answers, and
its doc says so: "as `Display` divides by `10¹⁹`". The loop — `(remainder
<< 64) | word`, divide, take the remainder, `while words.last() ==
Some(&0) { words.pop() }` — is written in both, and `chunk(10)` is
`DECIMAL_BASE` under another name, as the `chunks` test asserts.

The tests already pin the two to one another: `radixes` asserts that
`to_radix_string(10)` equals `to_string()`.

### Proposal

One function holds the division: the remainders of the words divided by
`base`, least significant first. `Display` writes them with `{:019}`;
`to_radix_string` expands each into `width` digits. `DECIMAL_BASE` goes,
replaced by `chunk(10)`.

### Tasks

- [ ] Extract the loop; both callers onto it; `cargo test`, `cargo
      clippy`, `cargo fmt -- --check`.

### Related

- [bigint-word-layer-owner](./bigint-word-layer-owner.md) — the trim inside
  this loop is one of the three spellings it lists; this issue is the loop
  around the trim.
