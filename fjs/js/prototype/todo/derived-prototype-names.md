## derived-prototype-names. `prototypeNames` restates the union its seven lists spell

**Priority:** P4
**Status:** open

### Problem

The defect [derived-keyword-union](../../keywords/todo/derived-keyword-union.md)
files against `keywords`, in its sibling: [`module.f.mjs`](../module.f.mjs)
declares seven per-type lists and then `prototypeNames`, about a hundred
strings re-typed by hand in alphabetical order, held to the lists by a
proof:

```js
// fjs/js/prototype/proof.f.mjs, aggregate      // fjs/js/keywords/proof.f.mjs, aggregate
const union = new Set(lists.flat())              const union = [...reservedWords, …, ...literalGlobals]
assertEq(prototypeNames.join(), sorted([...union]))
                                                 assertEq(keywords.join(), union.toSorted((a, b) => a < b ? -1 : 1).join())
assertEq(prototypeNames.length, union.size)      assertEq(keywords.length, new Set(keywords).size)
```

Both proofs also spell the comparator inline rather than `cmp` from
`fjs/types/string`. And the placement disagrees: `prototype/types.ts`
states that a compile-time claim about exports lives at module scope and
holds `_NamesPinned` there; `keywords` has no `types.ts` and buries its pin
in a proof-body typedef.

### Proposal

Whatever the keyword issue decides — derive the union from the lists,
sorted, with the literal type preserved — is decided once and applied
here too; the two proofs share one sorted-and-distinct check; `keywords`
gains the `types.ts` its sibling's rule asks for.

### Tasks

- [ ] Land with, or immediately after, the keyword derivation, by the same
      construction.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../keywords/todo/derived-keyword-union.md`](../../keywords/todo/derived-keyword-union.md) —
  the same construction, scoped to `keywords` only.
