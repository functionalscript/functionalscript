## 211. Reporter modes for the test framework

**Priority:** P3
**Status:** blocked
**Blocked by:** [Command output: one design for every destination](../../todo/command-output.md)

> **Why blocked.** This proposes a mode system for the proof runner. The modes
> are not the runner's — every `fjs` command writes to the same destinations —
> so the epic above generalises it. The stream rule below is settled for the
> **stream** reporters and is an input to that design rather than a question
> for it — not for the bridge this issue also proposes, which emits a
> framework's calls rather than characters and so has no stream to own.

The `Reporter<O>` interface (`moduleStart` / `enter` / `pass` / `fail` / `summary`,
each an `Effect<NodeOp, void>`) makes the walker reporter-agnostic. Several concrete
reporter implementations follow naturally.

### Every mode writes to `stdout`

Whatever modes exist, a run's records go to one stream. `stdout` and `stderr`
are not ordered against each other, so a report split across them cannot be
read back as a sequence — and where a failure sat among the tests around it is
exactly what a reader of a test log is asking. `stderr` is for a runner
*crash*: the tail's channel-failure message, written once there is no longer a
run to correlate anything with.

`fjs t` was split across both until functionalscript#1790 — failures and
GitHub annotations on `stderr`, progress on `stdout` — which also meant a
leaf's announcement and its verdict landed on different streams when the leaf
failed, and they are now two halves of one line. A mode that wants a separate error stream has to answer
the ordering question first.

### GitHub Actions reporter

`module.f.mjs` currently reads `options.env['GITHUB_ACTIONS']` at startup and switches
output format for the entire run:

```ts
const isGitHub = options.env['GITHUB_ACTIONS'] !== undefined
if (isGitHub) {
    return csiError(`::error file=${k},line=1,title=${i}()::${r}`)
} else {
    return csiError(`${i}() ${fgRed}error${reset}, ...`)
}
```

This hardcodes knowledge of a specific CI environment inside the test walker. The
GitHub output path should be extracted into a `githubReporter` factory so it is
testable via the virtual runner and the walker stays environment-agnostic.

### Quiet reporter

A reporter where `enter` and `pass` are no-ops (`pure()`); only `moduleStart`,
`fail`, and `summary` produce output. Useful for CI logs where passing tests are noise.
Selected via a CLI flag or env. See
[test-framework-silent-mode](./test-framework-silent-mode.md), the retired `i21`
under its current slug.

### TTY and non-TTY are different formats

The mode question this file lists is joined by one the open-line format raised:
a terminal and a line-oriented consumer want different records for the same
run. See [TTY and line-oriented consumers](tty-and-line-consumers.md), which
also notes that CI-ness is a second axis rather than the same one.

### Dynamic progress reporter

When stdout is a TTY, a reporter that shows a running counter and the currently-executing
test path, overwritten on each event. Falls back to the verbose reporter on a non-TTY
destination. Corresponds to the progress item in
[test-framework-silent-mode](./test-framework-silent-mode.md) (`i21`), which asks
for "brief progress (for example, a dot per test or a summary)" — a dot stream,
not a bar; a bar is this section's own extension of it.

### Node / Bun bridge reporter

A reporter that converts walker events into the corresponding surviving process
framework's `subTest` calls, allowing `module.ts` to reuse the Effects walker instead of
maintaining its own scan loop. The landed i163 work added `test(throws, f)` to
`Reporter<O>` that enables this.

This bridge is for process-side adapters such as Node and Bun. It must not restore the
removed Node-side Playwright wrapper. Browser execution, including execution launched by
`playwright test ...`, uses the shared in-browser runner and consumes its serializable
report instead of translating walker events into Playwright tests.

### Tasks

- [ ] Extract the GitHub Actions reporter.
- [ ] Add quiet and dynamic-progress reporters.
- [ ] Add or retain bridge reporting only for surviving process-side adapters.
- [ ] Keep Playwright reporting in the browser-testing adapter, where one Playwright test
      opens the shared HTML application and interprets its final report.

### Related

- [test-framework-silent-mode](./test-framework-silent-mode.md) (`i21`) —
  silent/verbose mode and brief progress
- i155 — original issue; reporter modes extracted here
- i163 — `test(throws, f)` on `Reporter<O>` enabling the process-runner bridge reporter
- [browser-testing](browser-testing.md) — browser-native execution and Playwright report
  integration
