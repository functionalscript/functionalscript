## derived-keyword-union. `keywords` restates the union its groups already spell

**Priority:** P4
**Status:** open

### Problem

`module.f.mjs` declares `reservedWords` (38 entries),
`strictModeReservedWords` (8), `restrictedNames` (2) — and then `keywords`
(`:51-59`), a fourth literal list re-typing all 48 of those strings plus
`undefined`. The module's own JSDoc concedes the duplication: "The proof
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
            'undefined'].toSorted())
```

**The alphabetical order is part of the public contract** — the export's
JSDoc promises it, so external consumers may observe it even though the
in-repository importers are order-insensitive (`js/tokenizer` folds the
list into an `ordered_map`, which sorts; `djs/tokenizer` builds a `Set`).
Deriving *and sorting* keeps that contract intact, so this is not a
breaking change. The type narrows from the exact `as const` tuple to a
`readonly` array of the literal union (`_Keyword` = the three groups plus
`'undefined'`); `(typeof keywords)[number]` — the form consumers use
(`fjs/js/tokenizer/types.ts:105`) — is unchanged, and nothing found uses
the tuple positions. If the tuple type turns out to matter to someone, the
fallback is the unsorted spread in group order — a **breaking change** that
must then be declared as such (`Changelog:` with `**BREAKING CHANGES:**`)
and the JSDoc's "alphabetically" rewritten, not silently reordered.

The runtime half of the proof (`proof.f.mjs:11-26`) reduces to checking
the derivation's membership is duplicate-free, or is deleted; the
type-level `Assert` can stay as the drift guard for the groups themselves.

### Tasks

- [ ] Derive `keywords` as the sorted union, preserving the documented
      alphabetical order; keep `(typeof keywords)[number]` intact via the
      literal-union element type.
- [ ] Simplify the proof accordingly.
- [ ] `tsc`, `fjs t`.
