# 156. Tests for `dev/tf`: virtual test files + capture reporter

The `dev/tf` test runner currently has no tests of its own. We want to verify the walker, the path threading, the throw semantics, the return-value sub-tree behavior, the pass/fail/total counts in `summary`, and the default reporter's formatting — all without running real test files on disk.

## Proposed design

Run `test(reporter)(options)` inside the virtual node runner (`fs/types/effects/node/virtual`) with:

### Virtual test files via an `import` dictionary

Each "virtual test file" is associated with an unknown JS value (the would-be `default` export, or the whole module). The `import` effect handler, currently `todo` in the virtual runner, becomes a dictionary lookup: `dict[path] → { default: ..., otherExport: ... }`. Loading the test fixture is just a map; nothing is parsed or evaluated.

### Test functions return `SandboxResult` directly

Test functions in virtual fixtures don't throw or perform real work. They return a `SandboxResult<unknown>` (`{ result: ['ok' | 'error', value], duration: number }`). The virtual `sandbox` handler short-circuits: it calls `f()` and returns its value as the `SandboxResult`, with no try/catch and no clock read. This makes tests deterministic — the fixture controls pass/fail and duration explicitly.

### Capture reporter

A `Reporter` that pushes each event into an array of tagged records:

```ts
type Event =
    | readonly['moduleStart', string]
    | readonly['enter', readonly string[]]
    | readonly['pass', readonly string[], number]
    | readonly['fail', string, readonly string[], unknown, number]
    | readonly['summary', number, number, number]
```

Every method returns `pure(undefined)` after pushing. Tests assert on the event list, which is structural data — no string parsing.

## Anything else

- **Env injection**: `NodeProgramOptions.env` carries `INIT_CWD` (controls which directory `loadModuleMap2` scans) and `GITHUB_ACTION` (selects the GitHub reporter path in `main`). Both must be settable per test.
- **Virtual filesystem stubs**: even with the import-dictionary trick, `loadModuleMap2` calls `readdir` and `access` to discover what looks like a test file (`*.test.f.js` / `*.test.f.ts`). The virtual `state.root` must be populated with the file paths from the dictionary so discovery succeeds; their contents (`Vec`) can be empty since `import` ignores them.
- **Write capture**: the virtual runner already accumulates `state.stdout` / `state.stderr` via the `write` handler. For tests that exercise `main` (not just `test(reporter)`), assert on these strings to verify the default reporter's formatting (including the GitHub `::error` annotations and percent-encoding).
- **Extract the default reporter** into a named exported factory (e.g. `defaultReporter(options): Reporter`). Without this, the GitHub format path can only be tested end-to-end via `main`. With it, we can feed synthetic events into the reporter and assert on the resulting `Write` effects directly.
- **Coverage targets** (the test fixtures we should write):
    - flat object of tests
    - nested objects (`{ math: { add: …, sub: … } }`)
    - `throw` key marking (both nested under a `throw` parent and via function `.name === 'throw'`)
    - return-value sub-trees (test fn returns an object → walked at same path)
    - special-character keys (containing `:`, `,`, `%`, quotes — verify path encoding and GitHub escaping)
    - integer-indexed keys (arrays — verify integer/identifier formatter)
    - non-default named exports (each becomes a top-level path segment)
    - mixed pass/fail to verify `summary` counts
- **Path-format helpers** (`fmtPath`, `fmtTerm`, `ghEscape`, `isInteger`, `isIdentifier`) should also get direct unit tests — they're pure functions and currently only exercised end-to-end.

## Related

- [i148](./148-test-framework-effects.md) — the Effect-based runner; this issue's tests are only possible because the runner is an Effect program.
- [i149](./149-sandbox.md) — the `Sandbox` effect; this issue depends on the virtual runner's `sandbox` handler being pluggable (already is).
- [i155](./155-test-runner-integration.md) — the "extract default reporter" item above is also called out as a follow-up there.
