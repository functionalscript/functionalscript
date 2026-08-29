## Report `fjs t` failures at the end

**Priority:** P3
**Status:** wip

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

### What landed

The deferral itself, in functionalscript#1787. `RunState` — the record the
shared traversal already threads through every leaf — now carries a `failures`
list beside the counts, `addLeaf` appends to it when a leaf's post-expectation
status is `failed`, and `Reporter.summary` receives the whole record. `fjs t`
writes only the pass/fail line as a leaf lands and describes the values it
failed with once the run has ended, in the order they landed; the GitHub
`::error` annotations moved to the same place, and a failing leaf now gets its
own line in that mode too, which it did not before.

Two details worth keeping:

- The failures are a `List`, joined with `concat` rather than a spread. The
  state is threaded through every leaf and joined at every module boundary, so
  an array would make the *n*th failure cost *n* again — the linear-join rule
  in [share-browser-console-runner](./share-browser-console-runner.md)'s
  catalog, which this is the second change in a row to trip over.
- A proof of one failing test cannot see the difference: with a single
  failure, deferred and inline produce the same stream. The proofs that
  hold this property are the ones with two failures separated by a passing
  leaf, and by a module boundary — mutation-tested by describing the value
  inline again, which fails exactly those two and nothing else.

The other half of the compact-progress goal —
[report-before-running](./report-before-running.md)'s event before a leaf runs
— landed for `fjs t` in the same PR, so a leaf now writes `name: running` and
then its own pass/fail line.

### Tasks

- [x] Integrate with the pre-test name event from
      [report-before-running](./report-before-running.md).
- [x] Extend the runner summary data to include ordered failed test names and errors.
- [x] Print only pass/fail after each test; defer error details to the final report.
- [x] Add proofs for multiple failures, ordering, and absence of inline error details.

### Related

- [Reporter modes](./211-reporter-modes.md)
- [Test Framework Silent Mode](./test-framework-silent-mode.md)
