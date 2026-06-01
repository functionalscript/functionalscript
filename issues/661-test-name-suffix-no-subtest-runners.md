# 661-test-name-suffix-no-subtest-runners. Test name suffixes required for runners without sub-test support

**Priority:** P3
**Status:** done

## Problem

Runners that do not support sub-tests natively (Bun, Playwright) must run all
generated tests inline inside the parent test. To make this visible in the
output and avoid name collisions, the registered test name must carry a suffix
that signals non-standard execution:

1. **`*`** — appended when a test generates sub-tests. The runner will execute
   all generated tests inside this single registration without registering them
   individually. The suffix warns that the reported test covers multiple logical
   tests bundled together.

2. **`throw`** — appended when a test is expected to throw. The runner has no
   native expected-to-fail semantics, so the wrapper catches the throw and
   reports a pass. The `throw` suffix makes the intent explicit in the output.
   (No `*` suffix is needed here because throw-tests do not generate sub-tests.)

Without these suffixes the output of Bun/Playwright runs looks identical to a
normal passing test, hiding the fact that multiple sub-tests or an
expected-failure wrapper is involved.

## Proposal

- Formalise the `*` and `throw` suffix rules in the test-runner integration
  documentation.
- Ensure the bridge code that registers tests with Bun and Playwright always
  applies the correct suffix.
- Add a note explaining why `*` and `throw` are mutually exclusive (throw-tests
  do not produce sub-tests).

## Tasks

- [x] Document the suffix convention in the relevant README or AGENTS.md
- [x] Verify the bridge code applies `throw` correctly for Bun and Playwright — added
      ` throw` suffix in `registerModule` (`fs/dev/tf/module.f.ts`)
- [x] Add test coverage for suffix assignment — `registerThrowSuffix` in `proof.f.ts`
- [x] `*` suffix — implemented via Option 3 (see proposal below).

## Proposal: `*` suffix via engine detection

The `*` suffix is only meaningful for Bun and Playwright — runners that lack
native sub-test support and execute return-value sub-trees inline. For Node
`--test`, sub-tests are properly nested and no suffix is needed.

Since sub-trees are only discoverable at runtime (after calling `fn()`), the
suffix cannot be added to the *already-registered* test name. However, we can
use the engine type to decide at call-site whether bundling will happen:

1. Pass the engine type (or a `supportsSubTests: boolean` flag) to
   `registerModule`. `NodeProgramOptions.engine` already carries this
   information.

2. Inside the `registerOne` callback, after `fn()` runs and `sub.length > 0`
   is confirmed, we know bundling occurred. Because we already know the engine
   is Bun/Playwright (no sub-test support), we can register each inline
   sub-test under a name derived from the *parent* name — e.g.
   `import("./f.ts").outer() * inner()` — making the bundling visible in the
   framework output without needing to rename the parent after the fact.

3. Alternatively, for Bun/Playwright, register the parent test with `*`
   suffix unconditionally (since ANY test *could* return sub-trees at
   runtime), and accept false positives for leaf tests that never do. The
   suffix then means "may bundle sub-tests" rather than "did bundle sub-tests."

Option 2 is cleaner but requires changing the sub-test name format.
**Option 3 was chosen and implemented**: `register` detects
`engine === 'bun' || engine === 'playwright'` and passes `suffixStar = true`
to `registerModuleMap` → `registerModule`. Only these two engines use
`inlineContext`, so the flag is always accurate without any runtime
sub-tree inspection.

## Related

- [i661-sandbox-isolated-test-execution](./661-sandbox-isolated-test-execution.md) — fjs t sandbox isolation vs. in-test sub-test execution
- [i661](./661-test-runner-behavior.md) — broader behavioural differences across supported test runners
