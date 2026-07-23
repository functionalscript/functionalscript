## id-prefix-tag-factory. `raw`/`hash` prefix-tag scheme written twice in `sul/id`

**Priority:** P4
**Status:** open

### Problem

`fjs/sul/id/module.f.ts` implements the "a 256-bit id is tagged by its top
set bit at `offset`; membership is `asBase(v) >> offset === 1n`" scheme
twice, byte-identical modulo the offset:

```ts
const rawPrefixOffset = 0xFEn                                  // :63
const rawPrefix = 1n << rawPrefixOffset                        // :65
export const isRaw = (v: Id): boolean =>
    asBase(v) >> rawPrefixOffset === 1n                        // :88-89

const hashPrefixOffset = 0xFFn                                 // :100
const hashPrefix = 1n << hashPrefixOffset                      // :102
export const isHash = (v: Id): boolean =>
    asBase(v) >> hashPrefixOffset === 1n                       // :111-112
```

Each pairing also carries a redundant `assertEq` of the resulting mask
(`:67-72`, `:104-109`). Adding a third tag class (or shifting the layout)
means repeating the triple again.

### Proposal

A module-scope factory, per the AGENTS.md curried-helper style:

```ts
const prefixTag = (offset: bigint) => ({
    prefix: 1n << offset,
    is: (v: Id): boolean => asBase(v) >> offset === 1n,
} as const)

const raw = prefixTag(0xFEn)
const hash = prefixTag(0xFFn)
export const isRaw: (v: Id) => boolean = raw.is
export const isHash: (v: Id) => boolean = hash.is
```

`rawId`/`toRaw`/`hashId` use `raw.prefix`/`hash.prefix`. The offsets and the
membership algorithm each appear once; the two `assertEq` mask checks can
collapse to one (or move into the proof).

Note the membership test is "the *topmost* set bit is exactly at `offset`"
(not merely "bit set") — the factory preserves that; keep a comment saying
so, since it is what makes `isRaw` false for hash ids.

### Tasks

- [ ] Add `prefixTag`; instantiate `raw`/`hash`; keep the exported
      `isRaw`/`isHash` signatures unchanged.
- [ ] `npx tsc`, `fjs t`; `fjs/sul/proof.f.ts` passes unchanged.

### Related

- [186](./186.md), [66m-sul-literal-level-reuse](./66m-sul-literal-level-reuse.md) —
  neighboring sul reuse work; this one is local to `sul/id` and independent.
