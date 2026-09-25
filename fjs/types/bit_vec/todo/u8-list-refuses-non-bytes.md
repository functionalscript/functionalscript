## `u8ListToVec` refuses an item that is not a byte

**Priority:** P3
**Status:** open

### Problem

[`../module.f.mjs`](../module.f.mjs)'s `u8ListToVec`, `u8ListToVecMsb` and
`tryU8ListToVec` are documented over "unsigned 8-bit integers", and none of
them checks that an item is one. `u8ToUnpacked` makes each item an 8-bit piece
as `{ length: 8n, uint: BigInt(b) }`, so a `uint` wider than its eight bits is
carried into the concatenation as it is. The result is the right length and
the wrong bytes, and nothing says so. Measured at `36c8d4a`:

| input to `u8ListToVecMsb` | bytes of the result |
| --- | --- |
| `[256]` | `[0]` |
| `[-1]` | `[255]` |
| `[65, 300, 66]` | `[65, 44, 66]` |
| `[64, 256]` | `[65, 0]` |

The last row is the sharpest: the extra bit of the wide item lands in its
*neighbour*, so the byte that was correct comes back changed.
`tryU8ListToVec` answers the same, since its `null` is only for a result
longer than `maxLength`. A fraction does not get through — `BigInt(1.5)` is a
`RangeError` — so the hole is integers outside `0..255`.

It reaches a public promise elsewhere. `fjs/git/oid`'s `digestOf` is
documented "@throws If an item of the bytes is not a byte", and hands the
bytes to `u8ListToVecMsb` unchecked: `digestOf(20)([300])` is the same id as
`digestOf(20)([44])`. That is the outcome
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules out: a plausible wrong answer where a refusal was owed.

### Proposal

Check each item where it becomes a piece. An item that is no byte is a
caller's mistake rather than an input to handle, which is §10's line for a
panic — the answer `fjs/ebnf/byte`'s `byteArray` already gives the same
mistake. Whether `tryU8ListToVec` panics too, or folds the case into its
`null`, is the one choice to make here.

The predicate exists as `isByte` in `fjs/ebnf/byte`, which `types/bit_vec`
should not import; where the two can share one is part of the change.

### Tasks

- [ ] Refuse an item that is no byte in the `u8ListToVec` family, with proof
      cases for `256`, `-1`, and a wide item in the middle of a list.
- [ ] Give `types/bit_vec` and `fjs/ebnf/byte` one byte predicate.
- [ ] A proof case in `fjs/git/oid` that `digestOf` refuses an item that is no
      byte, as its JSDoc says it does.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [byte-aligned-vec.md](./byte-aligned-vec.md) — the byte-aligned type these
  constructors would build.
- [`../../../todo/unguarded-numeric-domains.md`](../../../todo/unguarded-numeric-domains.md)
  — the same silent answer for non-integers; this is the integer half.
- [`fjs/ebnf/byte`](../../../ebnf/byte/module.f.mjs) — `isByte` and
  `byteArray`.
- [`fjs/git/oid`](../../../git/oid/module.f.mjs) — `digestOf`, where the hole
  is reachable from a public export.
