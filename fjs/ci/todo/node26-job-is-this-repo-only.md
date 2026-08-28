## node26-job-is-this-repo-only. `fjs ci` ships this repository's own gates

**Priority:** P3
**Status:** open

### Problem

`fjs ci` is offered to other projects as "FunctionalScript's default workflow"
([`fjs/README.md`](../../README.md)), and `ci(setup)` lets a caller vary only
`nodeExtra`, which reaches the per-OS platform jobs. The canonical Node jobs
come from `nodeVersionJobs` unconditionally, so every consumer's generated
`ci.yml` also gets the `node26` job — and that job is this repository's, not
theirs:

- `npm run ci-update`, then `git add -A && git diff --cached --exit-code` —
  regenerate-and-check-drift, against a script a consumer's `package.json`
  very likely does not define, so the step fails outright;
- the file-scope JSDoc `@typedef` prohibition (root `AGENTS.md`);
- both halves of the `@module` placement rule (`fjs/AGENTS.md` §2), added by
  the change that filed this issue.

The last three encode *this repository's* conventions. A consumer who writes a
file-scope `@typedef`, or puts `@module` on a `types.ts`, has broken no rule of
their own, and their build fails telling them so.

This is not a defect the `@module` guards introduced — `npm run ci-update` has
the same shape and predates them. What they did was make the pattern worth
naming: each convention added to `node26` widens the gap between what `fjs ci`
claims to generate and what it does.

### Proposal

No design agreed; the choice is what `fjs ci` is *for*.

- **Split the job.** `nodeVersionJobs` yields the portable per-version jobs;
  this repository's gates move to a `nodeExtra`-style hook it passes itself.
  A consumer gets Node 22/24/26 running their tests and nothing else.
- **Or narrow the claim.** Keep the job as it is and say in `fjs/README.md` and
  [`../README.md`](../README.md) that `fjs ci` generates *this* repository's
  workflow, and that other projects should use `fjs run <custom-ci-module>` —
  which `fjs/README.md` already offers as the escape hatch.

The first is the better API and the second is honest about today's. Either
settles it; leaving both claims standing is what should not continue.

Worth checking before choosing: whether any project outside this repository
actually runs `fjs ci`. If none does, the second option costs a paragraph and
the first is speculative generality.

### Tasks

- [ ] Decide which of the two the command is.
- [ ] Apply it, and make `fjs/README.md` and [`../README.md`](../README.md)
      agree — today the first offers the command to other projects and the
      second says the directory defines "the GitHub Actions workflow for this
      repository".

### Related

- [`../node/module.f.mjs`](../node/module.f.mjs) — `node26Steps`, the job in
  question.
- [`../module.f.mjs`](../module.f.mjs) — `ci(setup)` and `canonicalJobs`, where
  the jobs are assembled and `nodeExtra` stops short.
- [`../README.md`](../README.md) — describes the generator as this
  repository's; `fjs/README.md` offers it to others.
