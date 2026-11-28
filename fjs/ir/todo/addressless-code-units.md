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

Closing the hole needs **both** provenance and a constrained final
layout. Provenance alone is not enough: UTF-16 units (and values
round-tripped through string memory) can equal 16-bit chunks of a live
`0x7ff9… | p` owner, so unrestricted `or`/`shl` of approved code units
could still reassemble a second counted owner.

1. **A dedicated spelling** — for example a sealed or nominal `codeUnit`
   / `u16` carrier that **proven short-box / code-unit extraction**
   answers (`firstUnit`'s short-box branch, pack helpers). A raw
   `and`/`shr` of an `unseal` that is not such a helper does **not**
   produce the spelling.
2. **Seal only a valid short-box constructor** — an address-free `seal`
   of a counted type may take that spelling (and literals/tags) only
   through the **short-box pack path**: a fixed tag/layout the String
   module already uses (`short(…)`, pack helpers), with bounded unit
   count and shifts. Free recursive `or`/`shl` of code units into an
   arbitrary final word is **not** address-free, even when every leaf
   has the spelling. Today's `joined` path stays the template for what
   is allowed.
3. **Keep the debug trap** until the checker rule lands; then keep it as
   defense in depth, not as the only line.

Design note first (stack-open is enough); then checker + String/`firstUnit`
edits with proofs that forged address reconstitution is refused and that
short-box construction via `firstUnit` / pack helpers still type-checks.

### Tasks

- [ ] Design note: the IR spelling for code units; the allowed short-box
      constructors (tag, unit count, shifts); what replaces today's
      recursive `addressless` `or`/`shl` check
- [ ] Checker: accept address-free `seal` only for those constructors
      over the spelling / literals; refuse raw `unseal` slices and free
      `or`/`shl` reconstitution
- [ ] String / `firstUnit` (and any sibling helpers) answer the new
      spelling; short-box pack path updated
- [ ] Proofs: forged reconstitution refused (including code-unit chunks
      that numerically match address fragments); short-box construction
      and H3 string proofs still green

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
