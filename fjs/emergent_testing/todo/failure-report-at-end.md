## Report `fjs t` failures at the end

**Priority:** P3
**Status:** open

### Problem

`fjs t` should keep the test run output minimal and make failures easy to review together.
Printing exception details inline interrupts the run and scatters diagnostic information
throughout the log.

### Proposal

During test execution, print only whether each test passed or failed. Do not print
exception/error details during the run.

When a test fails, capture its normalized test name and error. After all tests finish,
print one consolidated failure report containing the failed test names and their errors.

The final failure report should:

- list every failed test by name;
- print the corresponding error/exception for each failure;
- preserve deterministic test order;
- include only actual failures after expected-failure semantics are applied.

Overall pass/fail counts and the process exit status remain unchanged.

### Tasks

- [ ] Extend the `fjs t` reporter state to retain failed test names and errors.
- [ ] During the run, render only pass/fail status for each test.
- [ ] Do not render exception/error details from per-test failure events.
- [ ] Render the collected failures as one report after test execution completes.
- [ ] Add proofs covering multiple failures, ordering, and absence of inline exception output.

### Related

- [Reporter modes](./211-reporter-modes.md) — reporter architecture and output modes.
- [Test Framework Silent Mode](./test-framework-silent-mode.md) — broader default-output simplification.
