# 664-tf-proof-entry-filter. `emergent_testing`: extract the duplicated "modules that export a proof" filter

**Priority:** P4
**Status:** done

## Problem

`fs/emergent_testing/module.f.ts` selects the entries of a `ModuleMap`
that export a `proof` property in two places, with byte-identical code:

```ts
// runModuleMap — fs/emergent_testing/module.f.ts:221-222
const modules = entries(moduleMap)
    .flatMap(([k, v]) => v.proof !== undefined ? [[k, v.proof] as const] : [])

// registerModuleMap — fs/emergent_testing/module.f.ts:244-245
const modules = entries(moduleMap)
    .flatMap(([k, v]) => v.proof !== undefined ? [[k, v.proof] as const] : [])
```

Both are the same operation: "given a `ModuleMap`, produce the
`[name, proof]` pairs for modules that have a proof." The two consumers
(`runModuleMap`, the runner; `registerModuleMap`, the `fjs t`
registration path) must stay in lockstep — if the selection rule ever
changes (e.g. to skip a module flagged as non-test, or to read a
differently named export), both call sites have to be edited identically.

The selection rule is also referenced from
[i664-emergent-testing-module-files](./664-emergent-testing-module-files.md),
which loads plain `module.*` files and relies on exactly this
`proof !== undefined` check to silently skip files without a proof. That
issue documents the behaviour but does not remove the duplication; naming
the operation makes that contract explicit and single-sourced.

## Proposal

Hoist a private module-scope helper that names the operation, and call it
from both functions:

```ts
// fs/emergent_testing/module.f.ts (private, module scope)
const proofEntries = (moduleMap: ModuleMap): readonly (readonly [string, unknown])[] =>
    entries(moduleMap)
        .flatMap(([k, v]) => v.proof !== undefined ? [[k, v.proof] as const] : [])
```

(`ModuleMap` types `proof?: unknown` in `fs/dev/module.f.ts:33`, so each
pair is `readonly [string, unknown]`.) Then both functions collapse to:

```ts
// runModuleMap
const modules = proofEntries(moduleMap)

// registerModuleMap
const modules = proofEntries(moduleMap)
```

## Why this qualifies

- **DRY:** exact, verbatim duplication across two consumers in the same
  module — squarely the case AGENTS.md names as "a core principle of
  FunctionalScript, not just a stylistic preference."
- **Separation of concerns:** "which modules count as tests" is one
  decision. Today it is spread across two functions and implicitly
  depended on by a third issue's loader change. One helper makes it the
  single source of truth.
- The change is purely local, preserves behaviour exactly (the `flatMap`
  idiom is unchanged — this is *not* a proposal to wrap the
  `cond ? [x] : []` idiom itself, which AGENTS.md endorses), and keeps the
  no-mutation, no-`as`-beyond-`as const` constraints.

## Related

- [i664-emergent-testing-module-files](./664-emergent-testing-module-files.md)
  — relies on this same selection rule when loading `module.*` files;
  extracting it here makes that contract explicit.
- [i65Z-tf-test-tree-walker](./65Z-tf-test-tree-walker.md) — a separate,
  larger DRY target (the `runModule`/`registerModule` *recursion*). This
  issue is strictly the map-level entry filter and is independent of it.
