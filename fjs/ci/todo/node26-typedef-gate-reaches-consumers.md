## node26-typedef-gate-reaches-consumers. `fjs ci` ships one convention consumers never agreed to

**Priority:** P5
**Status:** open

### Problem

`fjs ci` is offered to other projects as "FunctionalScript's default workflow"
([`fjs/README.md`](../../README.md)), and `ci(setup)` lets a caller vary only
`nodeExtra`, which reaches the per-OS platform jobs. The canonical Node jobs
come from `nodeVersionJobs` unconditionally, so every consumer's generated
`ci.yml` also gets the `node26` job.

Most of that job is a documented contract and works as intended.
[`../README.md`](../README.md) states which commands a consuming
`package.json` must provide — `cov` and `ci-update` — shows the typical
definitions, and explains that a project chains its own generators into
`ci-update` so the drift check covers them for free. This repository's own
`ci-update` spells itself `node ./fjs/module.mjs ci && …` only to avoid
depending on the package bin before the package is installed, which that README
says outright. So `npm run ci-update` and its drift check are an extension
point, not a private gate.

**One step is not covered by that contract: the file-scope JSDoc `@typedef`
prohibition.** It comes from root `AGENTS.md`, nothing asks a consumer to adopt
it, and no `Setup` field turns it off. A project that follows the documented
setup exactly — defines both scripts, writes ordinary JSDoc — gets a red
`node26` for breaking a rule that is not theirs, and the failure names a
convention they have never read.

P5: a reviewer notices this kind of thing, and no project outside this
repository is known to run `fjs ci` at all — see the question under the
options. Raise it the day one turns up.

That narrowness is the finding. Because the rest of the job does work for a
consumer who follows the documentation, a convention gate added to it is not
lost in an already-broken job: it is the one thing standing between them and a
green build. A pair of `@module` gates was very nearly added here for that
reason and reverted first — [root `AGENTS.md`
§6](../../../AGENTS.md#6-external-tools) now rules that approach out — but §6
governs *how* such a check is built, not whether `node26` is where it belongs.

### Proposal

No design agreed; the choice is what `fjs ci` is *for*.

- **Split the job.** `nodeVersionJobs` yields the portable per-version jobs;
  this repository's convention gates move to a `nodeExtra`-style hook it passes
  itself. A consumer keeps the documented `cov`/`ci-update` contract and gets
  none of our conventions.
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
