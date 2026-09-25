## Canonical `stringifySorted` export

**Priority:** P4
**Status:** open

### Problem

The composition `stringify(sort)` — serialize JSON with object keys sorted,
the repo's canonical order-independent serialization — is re-derived and
re-named at every use site instead of existing once under one name.

Source modules:

- `fjs/protocol/mcp/stdio/module.f.mjs` — `const stringifyJson = stringify(sort)`
- `fjs/media/revision`, `fjs/media/lock` and `fjs/media/note` — each module's
  `encodeText = stringify(sort)`, which
  [json-dialect-factory](../../todo/json-dialect-factory.md) would collapse
  into one factory

(`fjs/fsc/module.f.mjs` was another site; the compiler's `.json` output no
longer sorts, since key order is part of the value it writes, so it is gone.)

Proof files (each binds its own alias: `jsonStr`, `str`, `stringify`,
`stringifyJson`):

- `fjs/types/btree` and its `find`, `set` and `remove` proofs
- the proofs of `fjs/types/array`, `fjs/types/byte_set`, `fjs/types/range_map`,
  `fjs/types/sorted_list`, `fjs/types/sorted_set` and `fjs/types/list`
- the proofs of `fjs/text/ascii`, `fjs/text/utf8` and `fjs/text/utf16`
- the proofs of `fjs/media/json/extended`, `fjs/media/revision`,
  `fjs/media/lock` and `fjs/protocol/mcp/stdio`, and `fjs/media/json/demo.f.mjs`
- `fjs/fsc/parser/proof.f.mjs`

Each site is one line, so no single site is a problem — the issue is that
the canonical-serialization idiom has a crowd of different local names and no
single discoverable definition. Readers meeting `jsonStr` in one proof and
`str` in another must expand each alias to see they are the same thing, and
a future change to the canonical form (e.g. a different key ordering) has
no single point of definition.

### Proposal

Export the composition once from `fjs/media/json/module.f.mjs`, which already
imports from `fjs/types/object` (so the `sort` dependency adds nothing new):

```ts
/** `stringify` with object keys sorted — canonical, order-independent output. */
export const stringifySorted: (value: Unknown) => string = stringify(sort)
```

Then replace the local bindings at the sites above with an import. Sites
that wrap it further (`fjs/types/list/proof.f.mjs`'s `toArray` composition,
`fjs/text/utf16/proof.f.mjs`) keep their wrapper but call `stringifySorted`
inside. Hoisting the composition to module scope at each consumer also
aligns with the `AGENTS.md` rule on binding call-invariant partial
applications once.

### Tasks

- [ ] Add `stringifySorted` to `fjs/media/json/module.f.mjs` with proof
      coverage in `fjs/media/json/proof.f.mjs` (which itself calls
      `stringify(sort)` several times).
- [ ] Migrate the source-module sites — `fjs/protocol/mcp/stdio/module.f.mjs`,
      and the three dialects' `encodeText` through json-dialect-factory's kit
      if it lands first — then the proof files.
- [ ] Run `tsc` and `fjs t`.

### Related

- `fjs/media/json/serializer/module.f.mjs` — `colon` is exported there and
  shared with the djs serializer; that deduplication was separate from this
  issue and is done.
