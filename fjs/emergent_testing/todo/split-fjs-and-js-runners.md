## Split FJS and JS runners

**Priority:** P3
**Status:** wip

### Problem

The [six-job CI plan](../../ci/todo/six-ci-jobs.md) tests pure FJS across
engines and host JS across OSes and runtimes. Those checks need independent
test selection.

[`all.test.mjs`](../all.test.mjs) already registers both kinds of proofs with
the native Node, Deno and Bun runners. The built-in `fjs t` command also uses
the shared discovery in [`fjs/dev`](../../dev/module.f.mjs), which admits
host proofs on those runtimes. The command must instead select only FJS files.

### Proposal

Restrict `fjs t`, including the repository invocation `npm start t`, to
`.f.mjs` and `.f.js` files. This is a test-selection rule: host proof files
and legacy `.f.ts`/`.f.mts` files are outside that selection. The host code
implementing the runner can still be ordinary JavaScript.

Keep a combined native-runner entry and add two selective entries:

| Entry point | Proof selection | State |
| --- | --- | --- |
| `all.test.mjs` | FJS and host JS | Exists |
| `fjs-only.mjs` (tentative) | `.f.mjs` and `.f.js` | To add |
| `js-only.mjs` (tentative) | Existing opt-in host JS proof files | To add |

The proposed new names are placeholders until their invocation is verified
under Node, Deno and Bun. A selected run must execute the intended entry,
without silently running no tests or also discovering `all.test.mjs`.
Preserve a convenient combined run for developers.

Apply the selection before importing discovered modules, so excluded host
proofs do not execute during discovery. Reuse the shared discovery and
native-runner adapters. FJS selection can use
`isAuthored`, which already recognizes `.f.mjs` and `.f.js`. JS-only means the
existing opt-in host proof class; it must not import every ordinary `.mjs`
module as a test. It is also not simply the complement of `isAuthored` within
`shouldLoad`: that discovery includes legacy `.f.ts` and `.f.mts`, which must
not be reclassified as host JS. Keep these categories consistent across
entry points without copying the proof files or their test bodies.

The split serves these CI uses:

- Node coverage uses the FJS-only native entry; close any proof gaps exposed
  by removing host proofs, as [FJS-only coverage](./coverage-over-fjs-only.md)
  requires.
- Bun and SpiderMonkey run FJS through the repository's own runner.
- Node, Deno and Bun run host-JS effect tests through their native runners
  on Linux, macOS and Windows.

### Tasks

- [x] Provide a combined FJS and JS native-runner entry: `all.test.mjs`.
- [ ] Share explicit FJS-only and host-JS-only discovery categories.
- [ ] Restrict `fjs t` and `npm start t` to `.f.mjs` and `.f.js` discovery.
- [ ] Add an FJS-only native-runner entry.
- [ ] Add a JS-only native-runner entry.
- [ ] Verify filenames and invocations with Node, Deno and Bun: each selected
      suite runs, excluded proofs stay excluded, and the combined entry is
      not accidentally executed alongside it.
- [ ] Update the runner documentation and commands to explain the new `fjs t`
      scope and how to run host or combined suites.
- [ ] Connect the selective entries to the six-job CI allocation and update
      the affected cache inputs.

### Related

- [Six CI jobs](../../ci/todo/six-ci-jobs.md) — suite placement.
- [FJS-only coverage](./coverage-over-fjs-only.md) — Node coverage and proof gaps.
- [Select tests from the command line](./run-subset-of-tests.md) — finer module
  and case selection; this split only defines the FJS/host-JS categories.
- [Test runner](../module.f.mjs) — built-in `main` and native-runner `register`.
- [Discovery](../../dev/module.f.mjs) — `loadModuleMap`, `shouldLoadOn` and
  `isAuthored`.
