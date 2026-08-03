## run-subset-of-tests. Run a subset of proofs from the command line

**Priority:** P3
**Status:** open

### Problem

`fjs t` always runs every discovered proof. `main`
(`fjs/emergent_testing/module.f.ts`) passes `options` straight to
`testAll(defaultReporter(options))` and never looks at `options.args`, so
there is no way to say "run only these tests".

The only selection mechanism today is the working directory: module
discovery starts at `INIT_CWD`, so `cd fjs/base_n && fjs t` runs that
subtree. That is coarse — it cannot select a single proof module, a single
test case, or a set of cases matching a pattern, and it does not work at
all for a selection that spans directories.

This costs the most in the inner development loop: after touching one
module you either run the whole suite or manually `cd` into the right
directory and lose the failures reported elsewhere.

### Proposal

Let `fjs t` take positional arguments that select what to run. Two
independent axes, both derived from the path the walker already builds
(`fmtImport(moduleKey, testPath)` — module key plus the export path of the
test case, e.g. `fjs/types/list/proof.f.ts` → `proof.map.empty`):

- **module selection** — restrict which modules `loadModuleMap` loads, by
  passing a caller-supplied predicate into `allFiles`
  (`fjs/dev/module.f.ts` already takes one). Non-matching modules are never
  imported, so this is I/O-cheap, not just output filtering.
- **test-case selection** — restrict which entries of a loaded proof tree
  run, by filtering the `[path, TestEntry]` pairs `collectTests` returns.

Define the selector syntax and matching semantics independently from a particular runner.
The same contract should be usable by:

- `fjs t`;
- the surviving Node, Deno, and Bun process adapters;
- the shared browser application described by
  [browser-testing](./browser-testing.md).

For browser runs, the selector is passed through the generated page configuration, URL, or
controller protocol and applied by browser-side discovery/walking. The optional Playwright
Test adapter forwards the selector to that page and consumes the resulting report. It must
not route filtering through the removed per-proof Playwright `registerModule` path.

Open design questions to settle before implementing:

- the argument syntax: a path prefix (`fjs t fjs/types`), a substring
  match, or an explicit `module::test.path` form;
- whether a non-matching selector is an error (exit non-zero, "no tests
  matched") or a silent empty run — an error is safer against typos;
- how the summary reports a filtered run so a green partial run is not
  mistaken for a green full run;
- how process adapters expose the selector without conflicting with their
  own native filtering options;
- how the browser page serializes the same selector and reports matched/total counts.

### Tasks

- [ ] Settle the runner-independent selector syntax and record it in
      [../README.md](../README.md).
- [ ] Thread a module predicate from `options.args` through
      `loadModuleMap` into `allFiles`.
- [ ] Filter `collectTests` output by the test-case selector.
- [ ] Apply the same matching contract to the surviving Node, Deno, and Bun adapters.
- [ ] Pass browser selectors through the shared page/controller configuration and apply
      them inside the browser runner; Playwright only forwards that configuration.
- [ ] Report the active selector and the matched/total counts in every supported report;
      fail on a selector that matches nothing.
- [ ] Proof coverage via the virtual runner; `npx tsc`, `fjs t`.

### Related

- [GitHub issue #401](https://github.com/functionalscript/functionalscript/issues/401)
  — the original report.
- `fjs/emergent_testing/module.f.ts` — `main`, `collectTests`, `testAll`.
- `fjs/dev/module.f.ts` — `loadModuleMap` / `allFiles`; the predicate hook
  this needs.
- [211](./211.md) — reporter modes; a filtered run's summary is a reporter
  concern.
- [browser-testing](./browser-testing.md) — shared browser application and outer runners.
