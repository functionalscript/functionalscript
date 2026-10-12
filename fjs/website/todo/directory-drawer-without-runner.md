# Start the directory drawer on pages without a test runner

**Priority:** P3
**Status:** open

## Problem

`page`'s `runner` script in [`fjs/website/page/module.f.mjs`](../page/module.f.mjs)
does two things: it binds the browser test suite, and it calls
`startDirectoryDrawer` on the page's `[data-directory-layout]`. `testSection`
emits that script only where something can run: a directory with no proofs
returns no section at all, and one whose proofs are all browser-blocked
returns a section without the runner. On either page the drawer never
starts, so at mobile widths the page keeps the full inline catalogue instead
of the Contents and Issues drawer every other directory page gets.

The input that shows it: any generated directory page whose `dir.proofs` is
empty, or whose every proof has a non-empty `blockers` list.

Raised by Codex's review of
[#2836](https://github.com/functionalscript/functionalscript/pull/2836),
on code that pull request carries from `main` and does not change.

## Proposal

Emit the drawer's start with the directory layout rather than with the test
runner: a script of its own next to `directoryLayout`, or a bootstrap the
layout always carries, with `runner` keeping only the suite. A proof over a
directory with no proofs, and one with only blocked proofs, pins that the
start is emitted.

## Tasks

- [ ] Move the `startDirectoryDrawer` call out of `runner` and into the
  directory layout.
- [ ] Prove it on the two inputs above.
