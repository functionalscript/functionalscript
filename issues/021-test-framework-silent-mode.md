# Test Framework Silent Mode

**Priority:** P3
**Status:** open
**Blocked by:** [i139](./139-tf-translate-effects.md)

Simplify default output of the test framework. By default, show only brief progress (for example, a dot per test or a summary) and list failing tests. Provide a `--verbose` flag to enable the current detailed output.

Note: Do not start until issue 139 is done. The current `./fs/emergent_testing/module.f.ts` runs tests through a hand-rolled `Input<T>`/`measure`/`tryCatch` plumbing that mixes IO with pure logic. Adding a verbose toggle on top of that locks the new behavior into the legacy shape and would have to be reworked again once the framework is migrated to Effects. Translate the test framework to Effects first, then layer silent/verbose modes on the effect-based runner.
