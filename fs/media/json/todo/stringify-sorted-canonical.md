# Canonical `stringifySorted` export

**Priority:** P4
**Status:** open

## Problem

The composition `stringify(sort)` — serialize JSON with object keys sorted,
the repo's canonical order-independent serialization — is re-derived and
re-named at every use site instead of existing once under one name.

Source modules:

- `fs/mcp/stdio/module.f.ts:49` — `const stringifyJson = stringify(sort)`
- `fs/djs/module.f.ts:44` — `stringify(sort)(result[1])` inline

Proof files (each binds its own alias: `jsonStr`, `str`, `stringify`,
`stringifyJson`):

- `fs/types/btree/proof.f.ts:11`, `fs/types/btree/find/proof.f.ts:10`,
  `fs/types/btree/set/proof.f.ts:11`, `fs/types/btree/remove/proof.f.ts:16`
- `fs/types/array/proof.f.ts:6`, `fs/types/byte_set/proof.f.ts:8`,
  `fs/types/range_map/proof.f.ts:12`, `fs/types/sorted_list/proof.f.ts:10`,
  `fs/types/sorted_set/proof.f.ts:10`, `fs/types/list/proof.f.ts:37`
- `fs/text/ascii/proof.f.ts:6`, `fs/text/utf8/proof.f.ts:8`,
  `fs/text/utf16/proof.f.ts:15`
- `fs/media/json/parser/proof.f.ts:13`, `fs/mcp/stdio/proof.f.ts:13`
- `fs/bnf/data/proof.f.ts` (10 inline calls), `fs/djs/parser/proof.f.ts:306`,
  `fs/djs/serializer/proof.f.ts:47`

Each site is one line, so no single site is a problem — the issue is that
the canonical-serialization idiom has ~20 different local names and no
single discoverable definition. Readers meeting `jsonStr` in one proof and
`str` in another must expand each alias to see they are the same thing, and
a future change to the canonical form (e.g. a different key ordering) has
no single point of definition.

## Proposal

Export the composition once from `fs/media/json/module.f.ts`, which already
imports from `fs/types/object` (so the `sort` dependency adds nothing new):

```ts
/** `stringify` with object keys sorted — canonical, order-independent output. */
export const stringifySorted: (value: Unknown) => string = stringify(sort)
```

Then replace the local bindings at the sites above with an import. Sites
that wrap it further (`fs/types/list/proof.f.ts`'s `toArray` composition,
`fs/text/utf16/proof.f.ts`) keep their wrapper but call `stringifySorted`
inside. Hoisting the composition to module scope at each consumer also
aligns with the `AGENTS.md` rule on binding call-invariant partial
applications once.

## Tasks

- [ ] Add `stringifySorted` to `fs/media/json/module.f.ts` with proof
      coverage in `fs/media/json/proof.f.ts` (which itself calls
      `stringify(sort)` seven times today).
- [ ] Migrate the two source-module sites (`fs/mcp/stdio/module.f.ts`,
      `fs/djs/module.f.ts`), then the proof files.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fs/media/json/todo/serializer-shared-atoms.md` — separate serializer
  deduplication inside `fs/media/json`; no overlap.
