## Two modules spell `tryShellQuote` again

**Priority:** P4
**Status:** open

### Problem

[`module.f.js`](../module.f.js) exports the one POSIX quoting rule:

```js
// tryShellQuote
text.includes('\u0000') ? null : `'${text.replaceAll("'", "'\\''")}'`
```

Two modules re-write its body minus the NUL refusal: `quote` in
[`fjs/emergent_testing/cov`](../../../emergent_testing/cov/module.f.mjs),
which `_commandLine` uses to print the reproducible `cwd:` and `command:`
lines, and `shellWord` in [`fjs/ci/package`](../../../ci/package/module.f.mjs),
which `consumerCommands` uses for its `echo … > good.mts` steps and whose
comment reasons explicitly about an injection like `x'; printf PWNED; #`. The
export already has consumers in `fjs/effects/spidermonkey` and the website's
hash demo, so this module is the shared home
([AGENTS.md §1](../../../../AGENTS.md#1-workflow): export it, do not copy it).

### Proposal

Both modules import `tryShellQuote`. `cov` prints paths and `node` arguments
that cannot hold NUL, and the package check quotes generated source text, so
each `null` branch is a one-line refusal. If a total spelling is wanted,
export `shellQuote` beside `tryShellQuote` — still one body.

### Tasks

- [ ] Replace `quote` and `shellWord` with the export.
