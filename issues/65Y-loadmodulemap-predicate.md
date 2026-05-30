# 65Y-loadmodulemap-predicate. `loadModuleMap` should accept a file predicate

**Priority:** P3
**Status:** done

## Problem

`loadModuleMap` (`fs/dev/module.f.ts:111`) discovers all `.f.ts`/`.f.js`/proof
files under `INIT_CWD` and imports every one of them, regardless of whether
the caller needs the full set. Callers such as the test-framework
(`fs/dev/tf/module.f.ts:213,234`) then filter the resulting `ModuleMap` with
`isTest` after the fact:

```ts
const modules = entries(moduleMap).filter(([k]) => isTest(k))
```

All non-test files are loaded — performing real I/O and dynamic `import()`
calls — only to be thrown away. On large repositories this is a significant
and avoidable overhead.

## Proposal

Add an optional predicate parameter to `loadModuleMap`:

```ts
export const loadModuleMap = (
    env: Env,
    predicate: (path: string) => boolean = () => true,
): Effect<LoadModuleOperations, ModuleMap>
```

The predicate is applied inside `loadFile` (or before calling it) so that
files which don't match are skipped before any `import()` is attempted.

Callers that currently post-filter can pass their predicate directly:

```ts
// fs/dev/tf/module.f.ts
loadModuleMap(options.env, isTest).step(runModuleMap(reporter))
```

The default value `() => true` keeps the existing behaviour for callers
that want every module.

## Key locations

- `fs/dev/module.f.ts:111` — `loadModuleMap` definition
- `fs/dev/module.f.ts:88–96` — `loadFile`, where the per-file decision is made
- `fs/dev/tf/module.f.ts:213` — post-filter in `runModuleMap`
- `fs/dev/tf/module.f.ts:234` — post-filter in `registerModules`

## Caveats

- `loadFile` already skips files that aren't `.f.js`, `.f.ts`, or proof
  modules; the predicate is applied on top of that existing guard, not
  instead of it.
- If the predicate is cheap (e.g. a suffix check), the savings are mainly
  from avoided `import()` calls. If `allFiles` traversal itself becomes a
  bottleneck, a separate directory-level predicate could be added, but that
  is out of scope here.
