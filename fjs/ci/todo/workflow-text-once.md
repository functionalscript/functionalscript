## Workflow text and the cache directory, spelled once

**Priority:** P5
**Status:** open

### Problem

Two small rules of this generator are written in more than one module and
must agree.

The serialisation of a workflow, JSON with two-space indent, was spelled in
`writeWorkflows` in [`module.f.js`](../module.f.js) and twice more, as
`JSON.stringify(workflow, null, '  ')`, in `main` of
[`self`](../self/module.f.js). `writeWorkflows` is now exported and takes
`[path, workflow]` pairs, and `self` writes its two through it. What remains
there: `self` builds its two jobs by hand, restating `runs-on`,
`timeout-minutes` and `{ run: miseDevelop(…), shell: 'bash' }` rather than
going through `common`'s `job` and `mise`'s steps.

The cache's manifest directory, `join(env.RUNNER_TEMP ?? '',
`fjs-ci-${env.GITHUB_JOB ?? ''}`)`, is a private `manifestDirectory` in
[`cache`](../cache/module.f.js) and spelled again, with `'publish'`
appended, in [`cache/publish`](../cache/publish/module.f.js); if the two
drift, `publish` reads a directory `init` did not write.

### Proposal

Export `writeWorkflows` taking a list of `[path, workflow]` pairs, with
`workflowText` private to it, and have `self`'s `main` call it; export
`manifestDirectory` from `cache` and have `publish` join `'publish'` onto
it. The two hand-built jobs in `self` go through the builders once
[step-intent-not-text](./step-intent-not-text.md) gives a step its
environment.

### Tasks

- [x] `writeWorkflows` exported; `self` over it.
- [ ] `manifestDirectory` exported; `publish` over it.
- [ ] `npm run gen`; the committed workflows must not change.

### Related

- [step-intent-not-text](./step-intent-not-text.md) — what lets `self`'s
  jobs use the builders.
