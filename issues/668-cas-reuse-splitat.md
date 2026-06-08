# 668-cas-reuse-splitat. `fs/cas`: reuse `string.splitAt` instead of a local `split`

**Priority:** P5
**Status:** open

## Problem

`fs/cas/module.f.ts:30` defines a private helper:

```ts
const split = (s: string) => [s.substring(0, 2), s.substring(2)]
```

This is a hand-rolled re-implementation of a helper that the sibling
`fs/types/string` module **already exports**:

```ts
// fs/types/string/module.f.ts:38
export const splitAt = (p: number) => (v: string): readonly[string, string] =>
    [v.substring(0, p), v.substring(p)]
```

`split(s)` is exactly `splitAt(2)(s)` — same `substring(0, p)` / `substring(p)`
pair, only with `p` pinned to `2`. The local copy is used twice in `toPath`
(`fs/cas/module.f.ts:37-38`) to shard a Base32 key into two-character
directory segments.

AGENTS.md is explicit about this case: "When a sibling module already has
the type or helper you need, import it … rather than duplicating it." Here
the helper is already exported, so this is a pure reuse, not an extraction.
A secondary, smaller benefit: the local `split` returns a widened
`string[]`, whereas `splitAt` returns the precise `readonly [string, string]`
tuple — the destructurings `const [a, bc] = split(s)` and
`const [b, c] = split(bc)` get a tighter type for free.

## Proposal

Import `splitAt` and drop the local helper:

```ts
// fs/cas/module.f.ts
import { splitAt } from '../types/string/module.f.ts'

const split2 = splitAt(2)            // or inline splitAt(2) at the two call sites

const toPath = (key: Vec): string => {
    const s = vecToCBase32(key)
    const [a, bc] = split2(s)
    const [b, c] = split2(bc)
    return `${prefix}/${a}/${b}/${c}`
}
```

Binding `splitAt(2)` once at module scope (rather than calling `splitAt(2)`
twice) keeps the call-invariant `2` out of the per-call path, matching
AGENTS.md's "hoist call-invariant computations" guidance.

## Tasks

- [ ] Import `splitAt` from `fs/types/string` in `fs/cas/module.f.ts`.
- [ ] Replace the local `split` with `splitAt(2)` (hoisted as a module-scope
      constant) and delete the local definition.
- [ ] Confirm `npx tsc` and `npm test` (including `fs/cas/proof.f.ts`) pass —
      output paths are unchanged.

## Related

- AGENTS.md, *"When a sibling module already has the type or helper you need,
  import it"* — the governing rule for this change.
- [i668-path-join-segments](./668-path-join-segments.md) — a sibling
  separation-of-concerns cleanup in the same `fs/cas` module (inline
  `` `${a}/${b}` `` path joins). Independent of this one; both reduce ad-hoc
  string handling in `cas` in favour of the dedicated `string`/`path` modules.
