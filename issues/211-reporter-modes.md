# 211. Reporter modes for the test framework

**Priority:** P3
**Status:** open

The `Reporter<O>` interface (`moduleStart` / `enter` / `pass` / `fail` / `summary`,
each an `Effect<NodeOp, void>`) makes the walker reporter-agnostic. Several concrete
reporter implementations follow naturally.

## GitHub Actions reporter

`module.f.ts` currently reads `options.env['GITHUB_ACTION']` at startup and switches
output format for the entire run:

```ts
const isGitHub = options.env['GITHUB_ACTION'] !== undefined
if (isGitHub) {
    return csiError(`::error file=${k},line=1,title=${i}()::${r}`)
} else {
    return csiError(`${i}() ${fgRed}error${reset}, ...`)
}
```

This hardcodes knowledge of a specific CI environment inside the test walker. The
GitHub output path should be extracted into a `githubReporter` factory so it is
testable via the virtual runner and the walker stays environment-agnostic.

## Quiet reporter

A reporter where `enter` and `pass` are no-ops (`pure()`); only `moduleStart`,
`fail`, and `summary` produce output. Useful for CI logs where passing tests are noise.
Selected via a CLI flag or env. See [i21](./021-test-framework-silent-mode.md).

## Dynamic progress reporter

When stdout is a TTY, a reporter that shows a running counter and the currently-executing
test path, overwritten on each event. Falls back to the verbose reporter on a non-TTY
destination. Corresponds to the "colored progress bar" item in
[i21](./021-test-framework-silent-mode.md).

## Node / Bun / Playwright bridge reporter

A reporter that converts walker events into the corresponding framework's `subTest`
calls, allowing `module.ts` to reuse the Effects walker instead of maintaining its own
scan loop. See [i163](./163-reporter-test-method.md) for the `test(throws, f)` addition
to `Reporter<O>` that enables this.

## Related

- [i21](./021-test-framework-silent-mode.md) — silent/verbose mode and progress bar
- [i155](./155-test-runner-integration.md) — original issue; reporter modes extracted here
- [i163](./163-reporter-test-method.md) — `test(throws, f)` on `Reporter<O>` enabling the bridge reporter
