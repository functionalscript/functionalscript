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
export const keywords = /** @type {const} */ ([
    ...reservedWords, ...strictModeReservedWords, ...restrictedNames,
    'undefined',
])
```

Spreading `as const` tuples preserves the exact literal types, so
`(typeof keywords)[number]` — the form consumers use
(`fjs/js/tokenizer/types.ts`) — is unchanged. The runtime *order* changes
from alphabetical to group order; the known consumers are order-insensitive
(`js/tokenizer` folds the list into an `ordered_map`, which sorts;
`djs/tokenizer` builds a `Set`), but this must be confirmed against every
importer before landing, and the "alphabetically" claim in the JSDoc
rewritten. The runtime half of the proof (`proof.f.mjs:11-26`) reduces to
checking the derivation's membership is duplicate-free, or is deleted; the
type-level `Assert` can stay as the drift guard for the groups themselves.

### Tasks

- [ ] Derive `keywords` from the three groups; fix the JSDoc's ordering
      claim.
- [ ] Audit importers for order sensitivity; note the result in the PR.
- [ ] Simplify the proof accordingly.
- [ ] `tsc`, `fjs t`.
