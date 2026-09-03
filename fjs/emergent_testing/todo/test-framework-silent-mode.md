## Test Framework Silent Mode

**Priority:** P3
**Status:** blocked
**Blocked by:** [Command output: one design for every destination](../../todo/command-output.md),
[options-edsl](../../cli/todo/options-edsl.md)

> **Why blocked.** Silent and verbose are two values on the verbosity axis the
> epic above enumerates, and picking them for `fjs t` alone is how a command
> ends up with a mode system of its own.
>
> The second blocker is about the `--verbose` below rather than the modes.
> `options.args` is a raw string array, so reading a flag off it today means
> `args.includes('--verbose')` — invisible to the help table, and a typo
> becomes a positional. `options-edsl` is open to remove exactly that, so this
> issue would build what that one exists to delete. The epic finishing first
> does not make this actionable.

Simplify default output of the test framework. By default, show only brief progress (for example, a dot per test or a summary) and list failing tests. Provide a `--verbose` flag to enable the current detailed output.

The old blocker, "translate the test framework to Effects", has landed. Layer
silent/verbose modes on the current effect-based runner.
