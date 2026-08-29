## Report `fjs t` failures at the end

**Priority:** P3
**Status:** open

### Problem

`fjs t` should keep progress output compact while making failures easy to review together.
Printing exception details inline scatters diagnostic information throughout the log.

This must compose with [report-before-running](./report-before-running.md): the test name is
printed before the proof starts so a process crash still identifies the proof that was
running.

### Output

For each test, `fjs t` should:

1. print the test name before running it;
2. run the test;
3. print only its pass/fail status.

A normal test failure must not print its exception/error details at that point. Instead,
collect the failed test and its error. After all tests finish, print one consolidated
failure report containing every failed test name and its error.

Thus a runner crash leaves the last started test name visible, while an ordinary failure
keeps the run readable and moves diagnostics to the final report.

### Failure data flow

Do not keep failures in mutable reporter-local state. The shared traversal already folds
run data; extend that immutable result to carry failures as well as totals.

Introduce a failure record containing the information the final reporter needs to render
the same error it previously rendered inline, for example:

```ts
type TestFailure = {
    readonly test: TestResult
    readonly result: SandboxResult<unknown>
    readonly throws: boolean
}

type RunSummary = {
    readonly totals: RunTotals
    readonly failures: readonly TestFailure[]
}
```

Change `Reporter.summary` from `summary(totals: RunTotals)` to
`summary(summary: RunSummary)`. The traversal appends a `TestFailure` only when the
normalized `TestResult.status` is `failed`, preserving traversal order. `Reporter.result`
remains a per-test event and renders only status; it does not own the accumulated
failures.

The exact type names may change during implementation, but the data flow is required:
failures are accumulated immutably by the runner and passed explicitly to the final
summary reporter, never captured in a mutable closure.

### Final report

The final failure report should:

- list every failed test by name;
- print the corresponding error/exception for each failure;
- preserve deterministic test order;
- include only actual failures after expected-failure semantics are applied.

Overall pass/fail counts and the process exit status remain unchanged.

### Tasks

- [ ] Land or coordinate with the `start` reporter event from
      [report-before-running](./report-before-running.md).
- [ ] Extend the traversal result and `Reporter.summary` API to carry ordered failures
      explicitly.
- [ ] Print the test name before execution and only pass/fail status after execution.
- [ ] Do not render exception/error details from per-test result events.
- [ ] Render the collected failures as one report after test execution completes.
- [ ] Add proofs covering multiple failures, ordering, expected failures, absence of
      inline exception output, and the start-name/status sequence.

### Related

- [Report before running](./report-before-running.md) — the pre-test name record used by
  this output format.
- [Reporter modes](./211-reporter-modes.md) — reporter architecture and output modes.
- [Test Framework Silent Mode](./test-framework-silent-mode.md) — broader default-output
  simplification.
