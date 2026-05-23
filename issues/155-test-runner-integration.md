# 155. Test Runner: Code Duplication, GitHub Branching, and Bun Subtests

Three related problems with the current test runner architecture.

## 1. Code duplication between `module.f.ts` and `module.ts`

`fs/dev/tf/module.f.ts` contains the Effects-based runner (`walk`) that drives `fjs t`. `fs/dev/tf/module.ts` contains `scanModule` — a second, independent test-tree walk that bridges to Node `--test`, Bun, and Playwright. Both implementations traverse the same test tree (`parseTestSet`, throw semantics, return-value sub-trees) but share only the two exported helpers `isTest` and `parseTestSet`.

The duplication means that any change to traversal behaviour (e.g. the recent sub-tree/throw fix from [i154](./154-parseset-throws.md)) must be applied in two places. Ideally `module.ts` would drive the Effects-based runner rather than maintain its own walk.

## 2. `isGitHub` branching inside the Effects runner

`module.f.ts` reads `options.env['GITHUB_ACTION']` at startup and switches output format for the entire run:

```ts
const isGitHub = options.env['GITHUB_ACTION'] !== undefined
// ...
if (isGitHub) {
    return csiError(`::error file=${k},line=1,title=${i}()::${r}`)
} else {
    return csiError(`${i}() ${fgRed}error${reset}, ...`)
}
```

This hardcodes knowledge of a specific CI environment inside the test walker. A cleaner design would express the formatter as a parameter or a separate effect layer, keeping the walker environment-agnostic. This also blocks testing the GitHub output path via the virtual runner.

## 3. Bun: generated sub-trees break the flat framework

In `module.ts`, when a non-throw test function returns a sub-tree `r`, a new entry is appended to the `subTests` queue:

```ts
const r = set.fn()
subTests = [...subTests, [`${name}()`, r, false]]
```

This entry is later dequeued and `subTestRunner(name, ...)` is called for it. In the Bun-flat framework, `subTestRunner` maps directly to a top-level `fw.test(...)` call:

```ts
const createBunFramework = (fw: typeof nodeTest): CommonFramework =>
    (prefix, f) => f((name, v) => fw.test(`${prefix}: ${name}`, v))
```

Bun registers tests at import time. Calling `fw.test(...)` during test execution (i.e. inside a running test callback) is not supported: Bun silently drops or misorders the late-registered tests. The dynamically appended sub-tree entries are therefore lost.

### Possible fix for Bun

Instead of appending to `subTests` and calling `subTestRunner` later, run the generated sub-tree synchronously inside the current test callback without registering new top-level tests. The entire generated sub-tree would be traversed inline, with pass/fail signalled by throwing (consistent with how Bun expects subtests to behave). This could be implemented as a recursive helper that calls `subTestRunner` only for leaf test functions, not for intermediate tree nodes.

## Reporter modes enabled by the abstraction

With the `Reporter` interface (`moduleStart` / `enter` / `pass` / `fail` / `summary`, each an `Effect<NodeOp, void>`) the walker is reporter-agnostic. Several reporting modes become natural follow-ups:

- **Quiet mode** — a reporter where `enter` and `pass` are no-ops (`pure()`); only `moduleStart`, `fail`, and `summary` produce output. Useful for CI logs where passing tests are noise. Selected via a CLI flag or env. See [i21](./021-test-framework-silent-mode.md).
- **Dynamic progress mode** — when stdout is a TTY, a reporter can use `createConsoleText` (in `fs/text/sgr/module.f.ts`) or a similar in-place writer to show a running counter and the currently-executing test path that's overwritten on each event. On a non-TTY destination, fall back to the verbose reporter. Corresponds to the "colored progress bar" item in [i21](./021-test-framework-silent-mode.md).
- **GitHub Actions reporter** — already implemented inline in `main`; could be extracted into its own factory so the GitHub output path is testable via the virtual runner.
- **Node `--test` / Bun / Playwright bridge reporter** — converts events into the corresponding framework's `subTest` calls; resolves problem 1 by letting `module.ts` reuse the Effects walker instead of maintaining its own.

These are not in scope for this issue yet — they're listed to make clear what the abstraction unlocks.

## Related

- [i148](./148-test-framework-effects.md) — Effects-based redesign of the runner (now implemented); the walk duplication with `module.ts` is a direct consequence of keeping the bridge independent.
- [i154](./154-parseset-throws.md) — `parseTestSet` / `TestEntry` refactor; the duplication meant the fix had to be applied twice.
- [i21](./021-test-framework-silent-mode.md) — silent/verbose mode and progress bar; the reporter modes above are the implementation vehicle.
- [i29](./README.md) — browser testing; fixing the Bun runner architecture (problem 3) informs the browser runner design.
