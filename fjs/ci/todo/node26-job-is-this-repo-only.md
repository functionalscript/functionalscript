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
- the file-scope JSDoc `@typedef` prohibition (root `AGENTS.md`).

Both encode *this repository's* conventions, and the second is the clearer
case: a consumer who writes a file-scope `@typedef` has broken no rule of their
own, and their build fails telling them so.

This issue was filed alongside a pair of `@module` placement gates that would
have been a third. They were reverted before landing — a text pattern cannot
tell a JSDoc tag from the same characters in a string, and
[root `AGENTS.md` §6](../../../AGENTS.md#6-external-tools) now rules the
approach out — so the tree today carries only the two above. What the attempt
did was make the pattern worth naming: every convention `node26` acquires
widens the gap between what `fjs ci` claims to generate and what it does, and
§6 makes that gap harder to widen without noticing.

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
