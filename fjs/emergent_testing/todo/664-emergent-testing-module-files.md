## 664-emergent-testing-module-files. Load `module.js`/`module.ts` files for white-box testing

**Priority:** P4
**Status:** open

### Problem

`shouldLoad` in `fjs/dev/module.f.ts:61` currently admits only two categories of files:

1. All FunctionalScript modules — anything ending in `.f.ts` or `.f.js`.
2. Opt-in proof files — anything ending in `proof.ts`, `proof.js`, `proof.mts`, or `proof.mjs`.

```ts
// fjs/dev/module.f.ts:61
export const shouldLoad = (s: string): boolean =>
    s.endsWith('.f.ts')    || s.endsWith('.f.js')    ||
    s.endsWith('proof.ts') || s.endsWith('proof.js') ||
    s.endsWith('proof.mts')|| s.endsWith('proof.mjs')
```

Non-FunctionalScript modules — ordinary `.ts` / `.js` files — are invisible to
the test runner unless they are named `proof.*`. This works for black-box tests
(which live in `proof.*` files) but makes **white-box testing** (testing internal
implementation details) awkward: a developer writing tests alongside a plain
`module.ts` must either rename the target file or create a separate proof file
that imports internals just to reach them.

The natural place to put white-box tests for `module.ts` is `module.ts` itself
(or a co-located `module.test.ts`), mirroring how `.f.ts` files are bulk-loaded
regardless of whether they export a `proof` property.

### Proposal

Extend `shouldLoad` to also admit files ending in `module.ts`, `module.js`,
`module.mts`, or `module.mjs`:

```ts
export const shouldLoad = (s: string): boolean =>
    s.endsWith('.f.ts')     || s.endsWith('.f.js')     ||
    s.endsWith('proof.ts')  || s.endsWith('proof.js')  ||
    s.endsWith('proof.mts') || s.endsWith('proof.mjs') ||
    s.endsWith('module.ts') || s.endsWith('module.js') ||
    s.endsWith('module.mts')|| s.endsWith('module.mjs')
```

Whether a loaded `module.*` file actually exports a `proof` property is already
determined at runtime by the existing check in `runModuleMap` /
`registerModuleMap`:

```ts
// fjs/emergent_testing/module.f.ts:222,244
.flatMap(([k, v]) => v.proof !== undefined ? [[k, v.proof] as const] : [])
```

So files that do not export `proof` are silently skipped — exactly the same
behaviour as `.f.ts` files without a `proof` export. No changes to the runner
are required.

### Documentation

The JSDoc comment on `shouldLoad` (`fjs/dev/module.f.ts:51–60`) and the
`fjs/emergent_testing/` module documentation must be updated to reflect the new
loading rules, explaining that `module.*` files are loaded for white-box testing
of non-FunctionalScript modules while the `proof.*` convention remains for
standalone black-box proof files.

### Scope of change

- `fjs/dev/module.f.ts` — extend `shouldLoad`; update its JSDoc.
- `fjs/emergent_testing/` documentation — update to cover the new file-naming
  convention and its white-box testing use case.
- Tests for `shouldLoad` (if any exist) — add cases for `module.ts`/`module.js`.

### Non-goals

- The `.f.ts` / `.f.js` bulk-load behaviour is unchanged.
- The `proof.*` convention is unchanged and still recommended for standalone
  black-box proof files.
- No changes to the runner logic (`runModuleMap`, `registerModuleMap`,
  `runModule`, `registerModule`).
