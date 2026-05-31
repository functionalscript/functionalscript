# 65Z-singleton-effect. Singleton effect to prevent duplicate proof execution

**Priority:** P3
**Status:** open

## Problem

When the same module is reachable under more than one path — due to hard links,
copies, or a test runner discovering both the original and a generated alias —
its `proof` export is executed multiple times in the same process. This wastes
time and can produce confusing duplicate output.

### Concrete example: scenario runner

`run.sh` hard-links `all.ts` → `_all.test.ts` and a scenario file →
`_scenario.proof.ts`, then runs a test framework (node, bun, deno, playwright)
in the `scenarios/` directory. If the framework scans the directory it may
discover **both** `all.ts` and `_all.test.ts` (both end in `.ts` and both
export a `run()` call). Each discovered file loads and executes the module
independently under its own resolved path — Node.js caches by resolved URL,
not by inode — so the proof suite runs twice.

The same issue would arise if `all.ts` were copied to multiple locations for
use in different test environments.

## Proposal: a `singleton` effect

Add a `singleton` effect operation that a module can call before registering
its proofs. The effect checks whether a given key has already been registered
in the current process and, if so, returns without doing anything.

```ts
// usage in all.ts or any entry-point module
export const run = singleton('fs/dev/tf/all')(realRun)
```

### Semantics

```
singleton(key)(effect) ->
    if key already seen in this process: pure(undefined)
    else: mark key as seen, then run effect
```

### Implementation sketch

The singleton registry needs to survive across module reloads and be shared
by all instances of the same logical entry point. The natural place is
`globalThis`:

```ts
const registry: Set<string> = (globalThis as any).__fsRegistry ??= new Set()

export const singleton =
    (key: string) =>
    <O, A>(effect: Effect<O, A>): Effect<O, A | undefined> =>
        registry.has(key) ? pure(undefined) : begin
            .step(() => { registry.set(key); return effect })
```

The key should be stable across hard links and copies — a logical name
(e.g. the module's canonical import path relative to the repo root), not
`import.meta.url`, which would differ per copy.

### Alternative: inode-based deduplication

The effect runner could detect hard-linked files by comparing inodes before
importing them. This requires a `stat()` call per file and is specific to
Unix; it does not generalise to copied files or other runtimes (Deno, Bun,
browsers).

### Alternative: avoid the problem in run.sh

Instead of hard-linking `all.ts` → `_all.test.ts`, `run.sh` could use a
wrapper file that only imports `_scenario.proof.ts` and does not re-export
`all.ts`. This avoids the duplication for the scenario case but does not
address the general problem.

## Related

- [i65Z-ci-scenario-docker](./65Z-ci-scenario-docker.md) — CI scenario job; duplicate execution is a latent issue when multiple runners scan the same directory
- [i183](./183-tf-framework-scenario-tests.md) — scenario test infrastructure
