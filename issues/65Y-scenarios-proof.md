# 65Y-scenarios-proof. Scenario files were not converted to `export const proof`

**Priority:** P2
**Status:** done

## Problem

The bulk conversion in PR #889 (Step 1 of i65Y-proof-by-export) targeted files
named `*.proof.f.ts` / `*.proof.f.js` only. The scenario files under
`fs/dev/tf/scenarios/` use a different naming convention:

| file | kind | linked as by `run.sh` |
|------|------|-----------------------|
| `throw.pass.f.ts` | `.f.ts` | `_scenario.proof.f.ts` |
| `fail.fail.f.ts` | `.f.ts` | `_scenario.proof.f.ts` |
| `return-value.pass.f.ts` | `.f.ts` | `_scenario.proof.f.ts` |
| `thenable2.pass.f.ts` | `.f.ts` | `_scenario.proof.f.ts` |
| `async.pass.ts` | vanilla `.ts` | `_scenario.proof.ts` |
| `async.fail.ts` | vanilla `.ts` | `_scenario.proof.ts` |
| `async-subtests.pass.ts` | vanilla `.ts` | `_scenario.proof.ts` |
| `async-subtests.fail.ts` | vanilla `.ts` | `_scenario.proof.ts` |
| `thenable.pass.ts` | vanilla `.ts` | `_scenario.proof.ts` |

`run.sh` hard-links a scenario file as `_scenario.proof.f.ts` (or `.proof.ts`),
then runs the test framework on the `scenarios/` directory. After Step 2 the
runner discovers the linked file (it ends in `proof.f.ts`/`proof.ts`) but looks
for an exported `proof` property. None of the scenario files export `proof`, so
the runner finds **0 tests** in every scenario.

## Impact

| scenario type | expected exit | actual exit | outcome |
|---------------|---------------|-------------|---------|
| `*.pass.*` | 0 | 0 (0 tests run) | passes — silently, for the wrong reason |
| `*.fail.*` | 1 | 0 (0 tests run) | **wrong** — scenario runner reports FAIL |

`fail.fail.f.ts` and `async.fail.ts` (and `async-subtests.fail.ts`) currently
cause `run.sh` to exit 1 when the expected exit is also 1 (pass) — wait, that
is a coincidence. The real danger is that *passing* scenarios silently stop
exercising anything: `return-value.pass.f.ts`, `async.pass.ts`, etc. all run 0
tests and exit 0, masking regressions.

The unit tests (`npm test`) still pass because the scenario files are only
loaded when `run.sh` creates the hard links — they are not picked up by the
regular test run.

## Root cause

`throw.pass.f.ts` still uses `export default { ... }` (missed by the bulk sed).
All other scenario files use named `export const` with no `proof` wrapper.
After Step 1 the runner reads only `module.proof`; after Step 2 it loads all
`.f.ts`/`.f.js` but still requires `module.proof`.

## Fix

Add `export const proof = { ... }` to every scenario file, using the existing
named export as the single entry:

```ts
// throw.pass.f.ts  (currently export default)
export const proof = {
    throw: { a: () => { throw 'expected' } }
}

// fail.fail.f.ts
export const proof = {
    failing: () => { throw 'intentional failure' }
}

// return-value.pass.f.ts  (inner stays private)
const inner = () => {}
export const proof = {
    outer: (): unknown => ({ inner })
}

// thenable2.pass.f.ts
export const proof = {
    shouldPass: () => ({ then: () => 'ok' })
}

// async.pass.ts
export const proof = {
    sleep: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
    }
}

// async.fail.ts
export const proof = {
    sleep_fail: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        throw 'async failure'
    }
}

// async-subtests.pass.ts
export const proof = {
    withSubtests: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        return { sub1: () => {}, sub2: () => {} }
    }
}

// async-subtests.fail.ts
export const proof = {
    withSubtests: async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10))
        return { sub1: () => {}, sub2: () => { throw 'sub-test failure' } }
    }
}

// thenable.pass.ts
export const proof = {
    thenableResolves: () => ({
        then(resolve: (v: undefined) => void) { resolve(undefined) }
    })
}
```

## Tasks

- [x] Convert `throw.pass.f.ts` — replace `export default` with `export const proof =`
- [x] Convert `fail.fail.f.ts` — wrap `failing` in `proof`
- [x] Convert `return-value.pass.f.ts` — wrap `outer` in `proof`
- [x] Convert `thenable2.pass.f.ts` — wrap `shouldPass` in `proof`
- [x] Convert `async.pass.ts` — wrap `sleep` in `proof`
- [x] Convert `async.fail.ts` — wrap `sleep_fail` in `proof`
- [x] Convert `async-subtests.pass.ts` — wrap `withSubtests` in `proof`
- [x] Convert `async-subtests.fail.ts` — wrap `withSubtests` in `proof`
- [x] Convert `thenable.pass.ts` — wrap `thenableResolves` in `proof`
- [x] Verify `run.sh` with each runner: `fjs`, `node`, `bun`, `deno`

## Related

- [i65Y-proof-by-export](./65Y-proof-by-export.md) — proof discovery by export; Step 1 missed these files
- [i183](./183-tf-framework-scenario-tests.md) — original scenario test infrastructure
