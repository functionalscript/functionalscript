## Test Framework Silent Mode

**Priority:** P3
**Status:** blocked
**Blocked by:** [Command output: one design for every destination](../../../todo/plan/command-output.md)

> **Why blocked.** Silent and verbose are two values on the verbosity axis the
> epic above enumerates, and picking them for `fjs t` alone is how a command
> ends up with a mode system of its own.

Simplify default output of the test framework. By default, show only brief progress (for example, a dot per test or a summary) and list failing tests. Provide a `--verbose` flag to enable the current detailed output.

The old blocker, "translate the test framework to Effects", has landed. Layer
silent/verbose modes on the current effect-based runner.
