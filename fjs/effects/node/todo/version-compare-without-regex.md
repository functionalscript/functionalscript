## One version comparison, without a regular expression

**Priority:** P4
**Status:** open

### Problem

Two modules compare dotted version numbers, each its own way:

- `versionParts` / `versionLessThan` in `fjs/effects/node/module.f.mjs` strip a
  leading `v` with a regular expression — `version.replace(/^v/, '')` — before
  splitting on dots. [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1 forbids regular
  expressions in `.f.mjs`.
- `numbers` / `descending` in `fjs/website/changelog/module.f.mjs` split and
  compare dotted versions again, with a loop of their own rather than
  `versionLessThan`.

### Tasks

- [ ] Pick one owner module for the comparison and import it from both places.
- [ ] Replace the regular expression with `startsWith` / `slice`.

### Related

- [`fjs/AGENTS.md`](../../../AGENTS.md) §3.1, "No regular expressions".
