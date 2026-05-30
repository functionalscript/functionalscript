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

### Two-tier loading (the load gate differs by language)

Discovery (is-it-a-proof) is identical in both tiers — "does it export
`proof`?". Only the *load* gate differs, and it differs because the **safety
guarantee** differs:

| Language | Guard | Load gate |
|----------|-------|-----------|
| FunctionalScript | language: `.f.ts`/`.f.js` modules have no import side effects | load **all** `.f.ts` / `.f.js`, then look for exported `proof` |
| Vanilla TS/JS | filename opt-in (no language guarantee) | load only files **named** `proof.ts` / `proof.js` / `proof.mts` / `proof.mjs`, then look for exported `proof` |

FunctionalScript is safe to bulk-load by construction, so "load everything and
inspect" carries no risk. Vanilla TS/JS can execute arbitrary code on import, so
it stays **opt-in by filename**: renaming a file to `proof.*` is the author
declaring "this is safe to import for discovery." No denylist, no chasing
framework entry-point patterns. We explicitly do **not** bulk-load vanilla
modules with an exception list.

`.mts` / `.mjs` are included — they are first-class Node ESM extensions and
carry the same opt-in-by-name safety. (This is unlike the `.test.m.ts` pitfall
i204 warns about, which was about `.m` *infixed* in a name being confused with
`.mts`; a clean `proof.mts` has no such ambiguity.)

## Transition plan

A safe, ordered rollout for the FunctionalScript repo. Steps 1–2 are decided;
there is no step 3 (see Two-tier loading — vanilla stays opt-in by filename, we
do not bulk-load it).

**Step 1 — switch the contract from `default` to the `proof` property.**
Discovery still by filename (`isTest` unchanged); only *what the runner reads
inside a module* changes. Done in one commit so there is no broken intermediate:
- update the proof-tree walk in `fs/dev/tf/module.f.ts`,
- update the `register*` framework bridges (node `--test` / bun / Playwright)
  that key off the current export shape,
- convert all ~81 proof files from `export default …` to `export const proof = …`.

Hard cutover — read `proof` only, no `proof ?? default` fallback (a single
canonical contract is the point). Files that currently expose tests via *named*
exports must consolidate them into the single `proof` value; grep for those
before estimating.

**Step 2 — widen the load gate.** `isTest` accepts **all** `.f.ts` / `.f.js`
(load every FS module) plus vanilla `proof.{ts,js,mts,mjs}`. This is what
unlocks co-located white-box proofs (an FS module can now carry its own `proof`
export). The predicate now means "should-load," not "is-a-proof" — the
is-a-proof decision has fully moved to runtime — so rename it accordingly
(e.g. `shouldLoad` / `isLoadable`). Measure the cost of importing every FS
module once (expected negligible; pure FS imports have no side effects).

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

## Naming decision

The marker is **`proof`** (singular).

This is intended as a **public, ecosystem-neutral convention** aiming for
broad community adoption — not an FS-internal detail. The name was chosen
against that goal, so FS-branded options (`fsProof`, an `fs` prefix) were
rejected: a stranger should not feel they are importing "FunctionalScript's
thing." Among neutral options:

| Candidate | Why not chosen |
|-----------|----------------|
| `test` | Carries **false familiarity** — see below. Also collides with the `*.test.ts` framework ecosystem (i204) and reverses the deliberate proof-not-test stance. |
| `spec` | Same false-familiarity problem (BDD `describe`/`it`/`expect` lineage); overloaded and adjacent to `*.spec.ts` discovery. |
| `check` / `checks` | Plain and low-collision but less evocative of "this code proves itself." |
| **`proof`** | No pre-loaded JS meaning, so it signals "this is something new" rather than misleading. Neutral (no FS branding), unclaimed by existing test frameworks, reads naturally, and is a googleable term-of-art. **Chosen.** |

**Why not reuse `test` / `spec` — false familiarity.** These words already
carry concrete, learned meanings in JS, and our mechanism is *different*, so
reusing them would actively mislead, not just clash on a namespace:

- `test(name, fn)` / `it(...)` / `describe(...)` are **imperative registration
  calls** — you call a function that hands a callback to a runner. Our `proof`
  is a **plain exported value**: a data tree of zero-arg functions / nested
  objects / arrays, discovered *because it is exported*, with pass = "did not
  throw" plus the `throw` and return-value-sub-tree semantics. Nobody calls a
  `proof()`.
- `spec` carries the BDD `describe`/`it` + `expect` lineage; we have no
  assertion DSL and no nesting keywords.

A reader seeing `export const test = …` would expect the Mocha/Jest API and be
confused that it is a value, not a callback registry. A fresh word avoids that —
it tells the reader to go learn what it means, which is correct for a novel
mechanism.

If real-world collisions prove problematic, the fallback is to namespace the
*same word* (`$proof`, `__proof__`) rather than switch to a synonym — keep the
term, add a "reserved" signal. Not adopted now.

Note: a property name is the smallest part of making this a de-facto standard.
A normative spec (marker + proof-tree contract) and a zero-dependency reference
runner installable on any plain TS/JS project are what communities actually
adopt. Those are deliberately **out of scope** for this issue and left for
later.

## Design considerations / open questions

- **Loading cost.** Bulk-loading every FS module to inspect exports is safe and
  expected-negligible (pure FS imports have no side effects); resolved by the
  two-tier model — vanilla is not bulk-loaded, so its side-effect risk does not
  arise. Still worth measuring the FS import cost once (Step 2).
- **Predicate rename.** Once `isTest` matches every FS module it no longer means
  "is-a-proof" but "should-load"; rename it (e.g. `shouldLoad`) to avoid
  confusing the next reader.
- **Named-export consolidation.** Files currently exposing tests via named
  exports (not just `default`) must fold them into one `proof` value in Step 1.

## Tasks

- [x] Decide the marker — `proof` (singular); see Naming decision
- [x] Decide the load model — two-tier; no bulk vanilla loading
- [ ] **Step 1:** read `proof` (not `default`) in the proof-tree walk + update
      `register*` bridges + convert all ~81 proof files, in one commit
- [ ] **Step 1:** find and consolidate any named-export tests into `proof`
- [ ] **Step 2:** widen `isTest` to all `.f.ts`/`.f.js` + `proof.{ts,js,mts,mjs}`
- [ ] **Step 2:** rename the predicate (`isTest` → `shouldLoad`)
- [ ] **Step 2:** measure the cost of importing every FS module

## Related

- [i112](./112-cas.md) — CAS / Merkle DAG; names no longer first-class — the
  motivating context
- [i204](./204-test-ts-js-support.md) — current filename-suffix discovery
- [i65Y-rename-test-to-proof](./65Y-rename-test-to-proof.md) — the `proof`
  naming this builds on
