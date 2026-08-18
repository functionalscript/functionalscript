## Move `String` `Add` and `Any` `Mul` out of `impls/`

**Priority:** P4
**Status:** open

### Problem

Two more single-type impls sit in the `vm/impls/` grab-bag — the same
violation already filed for `Debug for String` and the UTF-16 `From` impls:

- `src/vm/impls/add.rs:5-10` and `src/vm/impls/add_assign.rs:5-9` —
  `Add`/`AddAssign for String<A>` is string concatenation, pure
  string-domain logic, while `vm/string/` exists and already holds
  `index.rs`, `partial_eq.rs`, `sized_index.rs`, `to_string.rs`. `impls/add.rs` mixes it with the unrelated
  `Add for Unpacked<A>`.
- `src/vm/impls/mul.rs:5-11` — `Mul for Any<A>`, while `Any`'s other
  operators live in `vm/any/add.rs`, `vm/any/neg.rs`,
  `vm/any/partial_eq.rs`. The convention is stated in the opposite direction
  at `src/vm/bigint/mul.rs:9`: "BigInt's Mul is implemented here, not under
  impls, because it needs private BigInt's stuff."

### Proposal

`vm/string/add.rs` (both `Add` and `AddAssign`) and `vm/any/mul.rs`;
`vm/impls/` keeps only the genuinely cross-type impls (`Unpacked`, and the
conversions [65Y](65y-nanvm-conversion-macros.md) will rework). Worth landing
together with the two filed moves so `vm/impls/` ends with one defensible
rule instead of a residue.

### Tasks

- [ ] Move the `String` and `Any` operator impls next to their types
- [ ] Land with [string-debug-placement](string-debug-placement.md) and
      [string-utf16-from-impls](string-utf16-from-impls.md)

### Related

- [string-debug-placement](string-debug-placement.md) — same category
- [string-utf16-from-impls](string-utf16-from-impls.md) — same category
