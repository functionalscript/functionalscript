# 183. Test-framework bridge: scenario-based conformance tests

## Problem

`fs/dev/tf/module.ts` bridges the Effects-based runner to Node `--test`, Bun, Deno,
and Playwright. There is no automated check that each framework bridge correctly
handles non-trivial test shapes such as return-value sub-trees (`.a().b()`).
The Bun issue ([i155 §3](./155-test-runner-integration.md)) was found by
inspection, not by a failing test.

## Proposed design

### Scenario files

Create a directory `fs/dev/tf/scenarios/` containing minimal FunctionalScript
modules, one per behaviour under test. Files are named `*.f.ts` (not
`*.test.f.ts`) so the normal test discovery mechanism does not pick them up
when running from the repository root:

| File | What it exercises |
|------|------------------|
| `pass.f.ts` | All tests pass (baseline) |
| `fail.f.ts` | One test fails (exit code 1) |
| `return-value.f.ts` | `outer()` returns a sub-tree containing `inner` — the `.a().b()` pattern |
| `throw.f.ts` | Tests under a `throw` key pass on error and fail on success |

More scenarios can be added as new edge cases are identified.

### Runner script

A shell script `fs/dev/tf/scenarios/run.sh <framework> <scenario>`:

1. Writes (or overwrites) a thin `test.f.ts` in a temporary directory that
   re-exports the chosen scenario:
   ```ts
   export * from '../scenarios/<scenario>.f.ts'
   ```
2. Sets `INIT_CWD` to that temporary directory so exactly one `*.test.f.ts` is
   discovered.
3. Invokes the framework's runner.
4. Compares the actual exit code against the expected value from the manifest
   (see below).
5. Exits 0 if they match, 1 otherwise.

The scenario files themselves are never `*.test.f.ts`, so they are never
auto-discovered outside this script.

### Expected-outcome manifest

A manifest (e.g. `scenarios/expected.ts`) maps each scenario to the expected
exit code per framework:

```ts
export const expected: Record<string, Record<string, number>> = {
    'pass':         { node: 0, deno: 0, bun: 0, playwright: 0 },
    'fail':         { node: 1, deno: 1, bun: 1, playwright: 1 },
    'return-value': { node: 0, deno: 0, bun: 1, playwright: 0 }, // bun known broken (i155)
    'throw':        { node: 0, deno: 0, bun: 0, playwright: 0 },
}
```

The `bun: 1` on `return-value` is the known failure documented in
[i155](./155-test-runner-integration.md). When i155 is fixed, that entry
becomes `0` and the manifest update is the end-to-end proof.

### CI integration

The script is called in a matrix: `framework × scenario`. A failure means the
bridge's behaviour diverged from documented expectations, not that a test inside
the scenario failed. This separates "the test logic is wrong" from "the
framework bridge is wrong".

## Design notes

- Scenario files are plain `*.f.ts` so they are type-checked alongside the rest
  of the codebase without a special build step.
- Expected outcomes that differ across frameworks document known limitations, not
  just test infrastructure.
- If stdout/stderr comparison is needed (beyond exit code), the manifest entry
  can be extended to include expected output snippets.

## Related

- i125 — original report: "`bun test` doesn't handle returned functions as tests"; proposed a manual rename of `integration/test.f.ts` to `integration/uncomment-test.f.ts` as the test vehicle. This issue replaces that manual approach with an automated script and a per-framework expected-outcome manifest.
- [i155](./155-test-runner-integration.md) — Bun subtest / generated-test breakage; the `return-value` scenario here is the automated form of the test described in i125 §3.
- [i170](./170-ci-tool-steps.md), [i175](./175-ci-setup-tool.md) — CI setup tooling that would run this matrix
