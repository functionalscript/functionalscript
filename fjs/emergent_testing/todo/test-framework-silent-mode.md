## Test Framework Silent Mode

**Priority:** P3
**Status:** open

Simplify default output of the test framework. By default, show only brief progress (for example, a dot per test or a summary) and list failing tests. Provide a `--verbose` flag to enable the current detailed output.

The old blocker, "translate the test framework to Effects", has landed. Layer
silent/verbose modes on the current effect-based runner.
