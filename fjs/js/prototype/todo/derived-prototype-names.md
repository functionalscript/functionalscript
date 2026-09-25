## derived-prototype-names. `prototypeNames` restates the union its seven lists spell

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) declares seven per-type lists and then
`prototypeNames`, about a hundred strings re-typed by hand in alphabetical
order, held to the lists by a proof:

```js
// fjs/js/prototype/proof.f.mjs, aggregate
const union = new Set(lists.flat())
assertEq(prototypeNames.join(), sorted([...union]))
assertEq(prototypeNames.length, union.size)
```

Its sibling `fjs/js/keywords` had the same defect and now derives
`keywords` from its groups instead:

```js
// fjs/js/keywords/module.f.mjs
const groups = [...reservedWords, ...strictModeReservedWords, ...restrictedNames, ...literalGlobals]

/** @type {readonly (typeof groups)[number][]} */
export const keywords = groups.toSorted()
```

The proof there reduces to one check — strictly ascending, so sorted and
each name once — plus the type-level pin that the element type is the
literal union. The derivation widened `keywords`' public type from the exact
`as const` tuple to a `readonly` array of that union, and was declared as a
breaking change for it.

The placement also disagrees: `prototype/types.ts` states that a
compile-time claim about exports lives at module scope and holds
`_NamesPinned` there; `keywords` has no `types.ts` and keeps its pin in a
proof-body typedef. And this proof spells the comparator inline rather than
`cmp` from `fjs/types/string`.

### Proposal

Apply the `keywords` construction here: derive `prototypeNames` from the
seven lists, sorted, with the literal element type preserved, and declare
the same tuple→array widening. Unlike the keyword groups, the prototype
lists share names (`toString`, `valueOf`, …), so the derivation dedupes
before sorting. Decide whether `keywords` gains the `types.ts` its sibling's
rule asks for.

### Tasks

- [ ] Derive `prototypeNames` by the `keywords` construction, deduped.
- [ ] Declare the type widening with a `**BREAKING CHANGES:**` changelog
      item in the implementing PR.
- [ ] `tsc`, `fjs test`.
