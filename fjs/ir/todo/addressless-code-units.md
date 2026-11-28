## Seal bits that cannot reconstitute an address

**Priority:** P3
**Status:** open — follow-up after H3 measure; does not block H3c–H3e

### Problem

A counted type that a module defines may be sealed from "bits that hold no
address": literals and integers of at most 16 bits, joined by `or` and
`shl`
([`fjs/ir/README.md`](../README.md),
[defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md)). The
checker's `addressless` predicate trusts that shape by **range**, not by
provenance: any `int` whose high bound is at most `0xFFFF` counts, whatever
produced it.

String's `firstUnit` takes a 16-bit piece from an `unseal`'s bits of a
short box
([`runtime/string/heap.f.js`](../runtime/string/heap.f.js)). Those pieces
pass `addressless`, and so would the same slices of a long string's box
put back together with `or`/`shl`. A forged second owner of a counted
value then type-checks; the debug arena traps the second `drop` or
`free`, which is a runtime net, not a checker guarantee.

The owner lock (2026-11-28): **do not keep** this 16-bit code-unit trust
hole. Plan a dedicated IR spelling so `firstUnit` (and the like) cannot
participate in address reconstitution. Sequence **after** H3 measure
unless a proof needs it earlier.

### Proposal

Give code units (and tags built only from them) a type or term form the
checker can tell from a truncated address fragment:

1. **A dedicated spelling** — for example a sealed or nominal `codeUnit`
   / `u16` carrier that `firstUnit` answers, and that `addressless` (or
   its successor) accepts only when the bits are that spelling or a
   literal/tag built from it — never a raw `and`/`shr` of an `unseal`.
2. **Refuse reconstitution** — `seal` of a counted type from `or`/`shl`
   of code-unit pieces remains allowed for short-box construction from
   **literals and pack helpers**, but not from pieces that came out of
   `unseal` of an existing owner.
3. **Keep the debug trap** until the checker rule lands; then keep it as
   defense in depth, not as the only line.

Design note first (stack-open is enough); then checker + String/`firstUnit`
edits with proofs that today's forged `seal(cell, or(…, firstUnit(…)))`
shape is refused.

### Tasks

- [ ] Design note: the IR spelling for code units / tags, how short-box
      `seal` still builds from pack helpers, and what `addressless`
      becomes
- [ ] Checker: accept only that spelling (plus literals) for
      address-free `seal` of a counted type; refuse `unseal` slices
- [ ] String / `firstUnit` (and any sibling helpers) answer the new
      spelling; short-box pack path updated
- [ ] Proofs: forged reconstitution refused; short-box construction and
      H3 string proofs still green

### Related

- [`fjs/ir/check/module.f.js`](../check/module.f.js) — `addressless`,
  `unitMost`
- [`fjs/ir/check/proof.f.js`](../check/proof.f.js) — `addressless` cases,
  including `and(shr(b, …), 0xFFFF)` accepted today
- [`runtime/string/heap.f.js`](../runtime/string/heap.f.js) — `firstUnit`
- [defined-hooks.md](../../../doc/sasha-gil/ir/defined-hooks.md) —
  documents the trust
- [heap.md](./heap.md) — H3 measure remains the string-path gate; this
  issue does not block H3c–H3e
