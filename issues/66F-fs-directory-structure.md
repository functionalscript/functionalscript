# 66F-fs-directory-structure. Group `fs/` subdirectories by concern

**Priority:** P4
**Status:** open

## Problem

`fs/` has 28 top-level directories that mix unrelated concerns at the same
level: foundational data structures (`types`), byte/character encoders
(`base64`, `base128`, `cbase32`), language tooling (`json`, `djs`, `fjs`,
`fsc`, `bnf`, `js`, `html`), crypto, storage (`cas`, `sul`), and pure project
infrastructure (`ci`, `dev`, `website`). The flat layout gives no hint of which
directories are siblings, so navigation and "where does a new module go?" are
harder than they should be.

Constraints to respect:

- Every cross-module import is a **relative `.f.ts` path** (`from
  '../../types/...'`) — there is no export map, so a move is mechanical but
  edits many files. `types/` alone has ~150 inbound references. This argues for
  **incremental** regrouping, one cohesive bucket at a time, not a big-bang
  reorg.
- `AGENTS.md`: new modules under a namespace are registered in the `deno.json`
  `exports` map; after moving files run `npm run update`, then verify with
  `npx tsc` and `fjs t`.

## Proposal

Regroup incrementally. Two concrete moves are agreed for now; the rest are
candidates recorded for later.

### 1. `fs/basen/` — group the base-N encoders

Move `base64`, `base128`, `cbase32` under a single `fs/basen/` directory. They
are sibling alphabet-parameterized encoders and are already slated to share a
codec factory (see [i66F-base-n-codec-factory](./66F-base-n-codec-factory.md)),
so a shared parent is their natural home. Coordinate the directory name with
that issue: if the shared factory lands as `fs/basen/module.f.ts`, the three
encoders become `fs/basen/base64`, `fs/basen/base128`, `fs/basen/cbase32`.

### 2. `fs/common/` — home for common algorithms

Create `fs/common/` for cross-cutting reusable algorithms, starting by moving
`monoid` (currently `fs/types/monoid`) there.

> Note: a `common/`-style directory carries a known risk of decaying into a
> junk drawer, since the name states no membership criterion. Decision: proceed
> with `common/` as requested. To keep it disciplined, admit a module only when
> it is a genuinely cross-cutting *algorithm* (not a data structure or a
> type-level utility — those stay in `types/`). Revisit the name/criterion if it
> starts collecting unrelated modules.

### 3. Stay at root for now

`crypto`, `mcp`, and `html` remain top-level — `crypto` is already a cohesive
namespace, and `mcp`/`html` are self-contained leaf domains.

### Later candidates (not in scope yet)

- `lang/` for the language/format tooling (`json`, `djs`, `fjs`, `fsc`, `bnf`,
  `js`, `html`) — highest value after the two moves above, but also highest
  churn (`json` has many inbound imports), so defer.
- A storage bucket for `cas` + `sul`; a testing bucket for `asserts` +
  `emergent_testing`.

## Tasks

- [ ] Create `fs/basen/` and move `base64`, `base128`, `cbase32` into it;
      coordinate the directory name with
      [i66F-base-n-codec-factory](./66F-base-n-codec-factory.md).
- [ ] Create `fs/common/` and move `monoid` from `fs/types/` into it.
- [ ] Update all relative imports referencing the moved modules.
- [ ] Update the `deno.json` `exports` map for the moved modules and run
      `npm run update`.
- [ ] Verify `npx tsc` and `fjs t` pass.
- [ ] Record the grouping rationale (and the `common/` admission criterion) in
      a `README.md` under the new directories.

## Related

- [i66F-base-n-codec-factory](./66F-base-n-codec-factory.md) — the shared
  base-N codec factory; its module home and this `basen/` directory should be
  decided together.
