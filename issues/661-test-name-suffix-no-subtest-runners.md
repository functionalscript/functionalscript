# 661-test-name-suffix-no-subtest-runners. Test name suffixes for runners without sub-test support

**Priority:** P3
**Status:** done

## Problem

Runners that do not support sub-tests natively (Bun, Playwright) must run all
generated tests inline inside the parent test, without registering them
individually. Without any signal in the test name, their output looks identical
to a normal passing test, hiding the fact that multiple logical tests ran inside
a single registration.

Additionally, `fjs t` did not indicate when a passing test was expected to
throw — it showed `ok` with no distinction, unlike Node `--test` which appends
`# EXPECTED FAILURE`.

## Implementation

### `*` suffix — Bun and Playwright registrations

`register` (`fs/dev/tf/module.f.ts`) detects `engine === 'bun' || engine === 'playwright'`
and passes `star = ' *'` down through `registerModuleMap` → `registerModule`.
For Node, `star = ''`. Inside `registerOne`, the registered name becomes:

```
import("./f.ts").proof.path() *    // Bun/Playwright
import("./f.ts").proof.path()      // Node --test
```

Throw-tests do not get `*` — they never produce sub-tests, and their path
already contains `.throw` which makes the intent visible:

```
import("./f.ts").proof.throw.a()   // no * suffix, path shows .throw
```

### `# EXPECTED TO THROW` — `fjs t` output

`Reporter.result` receives a `throws: boolean` parameter (passed from
`runModule`). `defaultReporter` appends `# EXPECTED TO THROW` to the output
line when `throws` is true:

```
import("./fs/dev/proof.f.ts").proof.throw(): ok, 0.18 ms # EXPECTED TO THROW
```

This matches the spirit of Node's `# EXPECTED FAILURE` while being specific to
the FunctionalScript throw convention.

## Why no ` throw` suffix on Bun/Playwright registrations

An earlier iteration appended ` throw` to the registered name for Bun/Playwright.
This was removed: the path already contains `.throw` (by the key or function-name
convention), so the suffix was redundant. The `# EXPECTED TO THROW` annotation
in `fjs t` output covers the visibility need for that runner.

## Tasks

- [x] `*` suffix on Bun/Playwright registrations (`registerModule`, `registerModuleMap`, `register`)
- [x] `# EXPECTED TO THROW` in `fjs t` output (`Reporter.result` gains `throws` param, `defaultReporter` uses it)
- [x] Test coverage: `registerSuffixes` in `fs/dev/tf/proof.f.ts`

## Related

- [i661-sandbox-isolated-test-execution](./661-sandbox-isolated-test-execution.md) — fjs t sandbox isolation vs. in-test sub-test execution
- [i661](./661-test-runner-behavior.md) — broader behavioural differences across supported test runners
