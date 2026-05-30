# 65Y-proof-by-export. Discover proofs by exported property, not filename

**Priority:** P3
**Status:** open

## Problem

Proof discovery currently relies on a filename convention: `isTest`
(`fs/dev/module.f.ts:60`) matches `*.proof.f.ts` / `*.proof.f.js` /
`*.proof.ts` / `*.proof.js`. The filename is *external metadata*, not part of
the module's content. When we store FunctionalScript modules in CAS as records
(see [i112](./112-cas.md)), names/paths stop being first-class identifiers —
modules reference each other by hash in a Merkle DAG. At that point a bag of
module records is **not self-descriptive**: nothing in the FS/TS/JS content of a
record tells us it is a proof. We would have to carry the convention out-of-band
in tree records that map names → hashes (the way Git trees name blobs), which
defeats the point of looking at the code alone.

## Proposal

Make a proof intrinsic to module *content*: a module is a proof (or contains
proofs) if it exports a well-known marker property, e.g. `proof`. The runner
loads modules and inspects exports for that property instead of (or in addition
to) matching filenames. The exported value reuses the existing proof-tree shape
(zero-arg functions, nested objects/arrays, `throw` semantics, return-value
sub-trees), so the execution engine in `fs/dev/tf/module.f.ts` is unchanged —
only *discovery* changes.

```ts
// today: discovered because the file is named *.proof.f.ts, via `default`
export default { add: () => { ... } }

// proposed: discovered because the module exports `proof`, regardless of name
export const proof = { add: () => { ... } }
```

This is consistent with FunctionalScript's philosophy that a module is just a
record of values — "is this a proof?" becomes a property of the value, not of
the path that happens to point at it. Discovery is uniformly "does the module
export `proof`?" — no reliance on filenames.

## White-box proofs

A proof's *location* determines what scope it can see. A proof co-located in a
module shares lexical scope with the module's private bindings, so it can prove
things about internals without exporting them (widening the public API purely
for testing). A proof in a separate module can only see the public exports.

| Mechanism | Scope | Runs when | Public-API exposure | Use for |
|-----------|-------|-----------|---------------------|---------|
| Module-level `assertEq(...)` | public + private | **every module load** | none | light, cheap, deterministic checks only |
| `export const proof` in module | public + private | under the runner | yes — mitigate via `: unknown` | white-box unit (non-FS adopters) |
| Separate module exporting `proof` | public only | under the runner | none (not shipped) | black-box / integration |

**Module-level asserts** work in *current* FunctionalScript and plain TS/JS code
today — e.g. `assertEq(2 + 2, 4)` at module top level. Because they run on
**every module load** (not under a test runner), they must be restricted to
*light* proofs: cheap, deterministic checks only. Never use them for stress or
benchmark tests — that cost would be paid on every import. Adopters need to
understand this execution model.

**`export const proof`** is a real export, so it leaks into the public API
surface (visible in an npm package's types and runtime). FunctionalScript keeps
proofs in separate, non-shipped `proof` modules, so this is a non-issue for FS
itself. Others adopting the convention in plain TS/JS should know `proof` is
exposed. At the TypeScript level this can be mitigated by always declaring
`proof` as `unknown` (keeps it out of meaningful consumer autocomplete/usage);
note this is a type-surface mitigation only — the runtime value still ships in
the bundle.

## Design considerations / open questions

- **Marker name & collisions.** `proof` is a fairly generic export name; a
  module could export `proof` for unrelated reasons. Options: reserve the name
  by convention, namespace it, or accept the small risk. (Symbols aren't a good
  fit — they aren't representable as plain FunctionalScript/JSON records.)
- **Loading cost.** Today `loadFile` (`fs/dev/module.f.ts:88`) skips importing
  non-test files. Export-based discovery requires importing *every* module to
  inspect its exports. For pure FunctionalScript modules this is safe (imports
  have no side effects) and arguably free; for the recently added plain
  `.proof.ts` / `.proof.js` support, side-effectful imports make
  "import everything" risky.
- **Co-location enables white-box testing.** A co-located `export const proof`
  (or module-level asserts) can prove things about private bindings; a separate
  module exporting `proof` is black-box / integration. Both are discovered the
  same way (the `proof` export). See the White-box proofs section for the
  exposure tradeoff and the `: unknown` mitigation.
- **Relationship to the filename convention.** Filenames could be kept as a
  cheap discovery *hint* (avoid importing everything) while the exported
  property is the source of truth, or dropped entirely. Keeping both during a
  transition is probably the pragmatic path.
- **Migration.** ~81 existing proof files export `default`. Switching to a named
  `proof` export (or recognizing `default` from any module) is mechanical but
  broad.
- **Framework bridge.** `register` / `registerModule` for node `--test` / bun /
  Playwright (`fs/dev/tf/module.f.ts`) also key off `isTest`; they'd need the
  same discovery change.

## Tasks

- [ ] Decide the marker (name `proof`, namespacing, default-export fallback)
- [ ] Document the white-box tiers (module-level asserts, co-located `proof`,
      separate `proof` module) and the public-API exposure tradeoff
- [ ] Add export-based discovery to `loadModuleMap` / `runModuleMap`
- [ ] Decide whether to keep filename matching as a hint or remove `isTest`
- [ ] Update the `register*` framework bridges
- [ ] Migration plan for the ~81 existing `default`-exporting proof files

## Related

- [i112](./112-cas.md) — CAS / Merkle DAG; names no longer first-class — the
  motivating context
- [i204](./204-test-ts-js-support.md) — current filename-suffix discovery
- [i65Y-rename-test-to-proof](./65Y-rename-test-to-proof.md) — the `proof`
  naming this builds on
