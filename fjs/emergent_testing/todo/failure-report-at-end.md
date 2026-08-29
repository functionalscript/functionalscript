## Report `fjs t` failures at the end

**Priority:** P3
**Status:** open

### Problem

`fjs t` should keep progress output compact and make failures easy to review together.
Exception details printed inline interrupt the run and scatter diagnostics through the log.

### Proposal

Coordinate with [report-before-running](./report-before-running.md): print the test name
before it runs, then print only whether it passed or failed.

For a failed test, collect its name and error instead of printing the error immediately.
After all tests finish, print the collected failures as one report, in test order.
Expected-to-fail tests should only be included when they are actual failures after the
existing expected-failure semantics are applied.

The internal runner/reporter API should be updated so the final summary receives the
collected failures explicitly. Do not keep them in mutable reporter-local state.

Overall counts and exit status remain unchanged.

### Tasks

- [ ] Integrate with the pre-test name event from
      [report-before-running](./report-before-running.md).
- [ ] Extend the runner summary data to include ordered failed test names and errors.
- [ ] Print only pass/fail after each test; defer error details to the final report.
- [ ] Add proofs for multiple failures, ordering, and absence of inline error details.

### Related

- [Reporter modes](./211-reporter-modes.md)
- [Test Framework Silent Mode](./test-framework-silent-mode.md)
