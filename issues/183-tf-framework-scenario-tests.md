# 183. Test-framework bridge: scenario-based conformance tests

**Priority:** P3
**Status:** open

## Problem

`./fs/emergent_testing/module.ts` bridges the Effects-based runner to Node `--test`, Bun, Deno,
and Playwright. There is no automated check that each framework bridge correctly
handles non-trivial test shapes such as return-value sub-trees (`.a().b()`).
The Bun issue (i155 §3) was found by
inspection, not by a failing test.

## Proposed design

### Scenario files

Create a directory `./fs/emergent_testing/scenarios/` containing minimal FunctionalScript
modules. Files are named `*.f.ts` (not `*.test.f.ts`) so the normal test
discovery mechanism does not pick them up when running from the repository root.

The expected exit code is encoded in the file name suffix — no separate manifest
needed:

| File | Expected exit code | What it exercises |
|------|--------------------|------------------|
| `return-value.pass.f.ts` | 0 | `outer()` returns a sub-tree containing `inner` — the `.a().b()` pattern |
| `throw.pass.f.ts` | 0 | Tests under a `throw` key pass on error and fail on success |
| `fail.fail.f.ts` | 1 | One test fails (exit code 1) |

A `.pass.f.ts` suffix means the framework must exit 0; `.fail.f.ts` means it
must exit 1. The runner script derives the expectation from the suffix — no
manifest to keep in sync.

More scenarios can be added as new edge cases are identified.

### Runner script

A shell script `fs/emergetn-testing/scenarios/run.sh <framework> <scenario-file>`:

1. Reads the expected exit code from the file name suffix (`.pass.f.ts` → 0,
   `.fail.f.ts` → 1).
2. Writes a thin `test.f.ts` in a temporary directory that re-exports the
   chosen scenario:
   ```ts
   export * from '../scenarios/<scenario-file>'
   ```
3. Sets `INIT_CWD` to that temporary directory so exactly one `*.test.f.ts` is
   discovered.
4. Invokes the framework's runner.
5. Exits 0 if the actual exit code matches the expected one, 1 otherwise.

The scenario files themselves are never `*.test.f.ts`, so they are never
auto-discovered outside this script.

### CI integration

The script is called in a matrix: `framework × scenario`. A failure means the
bridge's behaviour diverged from the documented expectation encoded in the file
name, not that a test inside the scenario failed. This separates "the test logic
is wrong" from "the framework bridge is wrong".

The known Bun failure on `return-value.pass.f.ts` (i155)
will appear as an expected CI failure for that cell until i155 is fixed.

## Design notes

- Scenario files are plain `*.f.ts` so they are type-checked alongside the rest
  of the codebase without a special build step.
- The suffix convention makes the expectation self-documenting and removes the
  need for a manifest file.

## Related

- i125 — original report: "`bun test` doesn't handle returned functions as tests"; proposed a manual rename of `integration/test.f.ts` to `integration/uncomment-test.f.ts` as the test vehicle. This issue replaces that manual approach with an automated script and suffix-convention files.
- i155 — Bun subtest / generated-test breakage; the `return-value.pass.f.ts` scenario here is the automated form of the test described in i125.
- [i170](./170-ci-tool-steps.md), [i175](./175-ci-setup-tool.md) — CI setup tooling that would run this matrix
