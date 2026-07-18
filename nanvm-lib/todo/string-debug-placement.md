# Move `Debug for String` to `vm/string/debug.rs`

**Priority:** P5
**Status:** open

## Problem

Bespoke `Debug` impls live in each type's own directory — `impl Debug for
BigInt` in `nanvm-lib/src/vm/bigint/debug.rs` and `impl Debug for Function`
in `nanvm-lib/src/vm/function/debug.rs` — but the equally bespoke
`impl<A: IVm> Debug for String<A>` sits in the shared grab-bag
`nanvm-lib/src/vm/impls/debug.rs:26-47`:

```rust
impl<A: IVm> Debug for String<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        const DOUBLE_QUOTE: u16 = '"' as u16;
        const BACKSLASH: u16 = '\\' as u16;
        const PRINTABLE_ASCII: RangeInclusive<u16> = 0x20..=0x7F;
        ...
    }
}
```

That is ~22 lines of string-domain logic (UTF-16 iteration, quote/backslash
escaping, `\uXXXX` for non-printable code units) grouped with the trivial
delegating impls (`Any`, `Array`, `Object`, `Unpacked`). The placement is
inconsistent with the per-type convention the other two bespoke Debug impls
follow, and it is the same separation-of-concerns issue that
`string-utf16-from-impls.md` records for the sibling UTF-16 `From` impls in
`impls/from.rs` — that todo does not cover the Debug impl.

## Proposal

Pure move, no abstraction change: create `nanvm-lib/src/vm/string/debug.rs`
containing `impl<A: IVm> Debug for String<A>`, register `mod debug;` in
`nanvm-lib/src/vm/string/mod.rs`, and delete the impl from
`impls/debug.rs` (which keeps only the delegating impls for the composite
types). Coordinate with `string-utf16-from-impls.md` so all string-domain
conversion/formatting code lands in `vm/string/` in one pass.

## Tasks

- [ ] Move the impl to `vm/string/debug.rs`; register the module.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

## Related

- [string-utf16-from-impls.md](./string-utf16-from-impls.md) — same
  misplacement for the string `From` impls; do both together.
- `nanvm-lib/src/vm/bigint/debug.rs`, `nanvm-lib/src/vm/function/debug.rs` —
  the per-type convention being matched.
