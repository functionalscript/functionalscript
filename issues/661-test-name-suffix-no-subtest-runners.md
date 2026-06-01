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
- [ ] `*` suffix (test bundles sub-tests inline) — requires knowing at registration time
      whether the test function will return sub-trees; not statically determinable.
      Deferred as a separate issue.

## Related

- [i661-sandbox-isolated-test-execution](./661-sandbox-isolated-test-execution.md) — fjs t sandbox isolation vs. in-test sub-test execution
- [i661](./661-test-runner-behavior.md) — broader behavioural differences across supported test runners
