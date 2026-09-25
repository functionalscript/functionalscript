## derived-keyword-union. `keywords` restates the union its groups already spell

**Priority:** P4
**Status:** open

### Problem

`module.f.mjs` declares four groups — `reservedWords`,
`strictModeReservedWords`, `restrictedNames` and `literalGlobals` — and then
`keywords`, a fifth literal list re-typing every string of the four in sorted
order. The module's own JSDoc concedes the duplication: "The proof
verifies this list is exactly the sorted union of the groups, at runtime and
at the type level" — one vocabulary in two places, held together by a test
rather than by construction, in a module whose header promises "one source
of truth". Adding a keyword means editing two arrays and re-alphabetizing
one of them by hand.

### Proposal

Derive it:

```js
export const keywords =
    /** @type {readonly _Keyword[]} */ (
        [...reservedWords, ...strictModeReservedWords, ...restrictedNames,
            ...literalGlobals].toSorted())
```

**The code-unit order is part of the public contract** — the export's
JSDoc promises it, so external consumers may observe it even though the
in-repository importers are order-insensitive (`js/tokenizer`,
`fsc/tokenizer` and `fsc/parser` each build a `Set`).
Deriving *and sorting* keeps the runtime contract intact. The public
*type* still changes: the exact `as const` tuple widens to a `readonly`
array of the literal union (`_Keyword` = the four groups), losing the
literal positions and literal `length` an
external TypeScript consumer could observe — `(typeof keywords)[number]`,
the form the in-repository consumers use
(`_KeywordKind` in `fjs/ebnf/lib/js/types.ts`), is unchanged. Preserving the exact
sorted tuple type is not an option worth taking: it would have to be
hand-written, which is the duplication this issue removes. So the
implementation **declares the tuple→array widening as a breaking change**
(`Changelog:` with `**BREAKING CHANGES:**`) even though the runtime value
is identical. The unsorted group-order spread stays only as a fallback —
a second, larger break (the observable value order) under the same
declaration.

The runtime half of the proof's `aggregate` entry reduces to checking the
derivation's membership is duplicate-free, or is deleted; the type-level
`Assert` can stay as the drift guard for the groups themselves.

**Every consumer also builds its own set.** The module exports arrays only,
so `js/tokenizer`, `fsc/tokenizer` and `fsc/parser` each bind
`const keywordSet = new Set(keywords)` to ask the one question they have — is
this word a keyword. The module whose header promises one source of truth
could answer that once.

### Tasks

- [ ] Derive `keywords` as the sorted union, preserving the documented
      code-unit order; keep `(typeof keywords)[number]` intact via the
      literal-union element type.
- [ ] Export the membership test once — an `isKeyword` predicate, or the set
      itself — and replace the three local `new Set(keywords)` bindings with
      it.
- [ ] Declare the tuple→array type widening with a
      `**BREAKING CHANGES:**` changelog item in the implementing PR.
- [ ] Simplify the proof accordingly.
- [ ] `tsc`, `fjs t`.
