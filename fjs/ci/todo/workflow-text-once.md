## Workflow text and the cache directory, spelled once

**Priority:** P5
**Status:** open

### Problem

Two small rules of this generator are written in more than one module and
must agree.

The serialisation of a workflow, JSON with two-space indent, is documented
on `workflowText` in [`module.f.mjs`](../module.f.mjs) and spelled there
in `writeWorkflows`; `main` in [`self`](../self/module.f.mjs) spells
`JSON.stringify(workflow, null, '  ')` twice more for its own two
workflows, and builds its two jobs by hand, restating `runs-on`,
`timeout-minutes` and `{ run: miseDevelop(…), shell: 'bash' }` rather than
going through `common`'s `job` and `mise`'s steps.

The cache's manifest directory, `join(env.RUNNER_TEMP ?? '',
`fjs-ci-${env.GITHUB_JOB ?? ''}`)`, is a private `manifestDirectory` in
[`cache`](../cache/module.f.mjs) and spelled again, with `'publish'`
appended, in [`cache/publish`](../cache/publish/module.f.mjs); if the two
drift, `publish` reads a directory `init` did not write.

### Proposal

Export `writeWorkflows` taking a list of `[path, workflow]` pairs, with
`workflowText` private to it, and have `self`'s `main` call it; export
`manifestDirectory` from `cache` and have `publish` join `'publish'` onto
it. The two hand-built jobs in `self` go through the builders once
[step-intent-not-text](./step-intent-not-text.md) gives a step its
environment.

### Tasks

- [ ] `writeWorkflows` exported; `self` over it.
- [ ] `manifestDirectory` exported; `publish` over it.
- [ ] `npm run gen`; the committed workflows must not change.

### Related

- [step-intent-not-text](./step-intent-not-text.md) — what lets `self`'s
  jobs use the builders.
