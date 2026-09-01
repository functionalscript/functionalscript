## ci-generator-audience. Say who `fjs ci` generates a workflow for

**Priority:** P5
**Status:** open

### Problem

Two documents claim different audiences for the same command.
[`fjs/README.md`](../../README.md) offers `fjs ci` to other projects as
"FunctionalScript's default workflow"; [`../README.md`](../README.md) says the
directory defines "the GitHub Actions workflow for this repository". Both are
maintained, and they cannot both be the contract.

The generator leans toward the first: `ci(setup)` lets a caller vary only
`nodeExtra`, which reaches the per-OS platform jobs, while `nodeVersionJobs`
yields the canonical Node jobs unconditionally — so every consumer's generated
`ci.yml` gets this repository's `node26` job whether or not they want it.

Most of that job is a documented contract and works as intended.
[`../README.md`](../README.md) states which commands a consuming `package.json`
must provide — `cov` and `gen` — shows the typical definitions, and
explains that a project chains its own generators into `gen` so the drift
check covers them for free. This repository's own `gen` spells itself
`node ./fjs/module.mjs ci && …` only to avoid depending on the package bin
before the package is installed, which that README says outright. So
`npm run gen` and its drift check are an extension point, not a private
gate.

**The one step that was not covered by that contract has been deleted.** The
file-scope JSDoc `@typedef` prohibition came from root `AGENTS.md`, nothing
asked a consumer to adopt it, and no `Setup` field turned it off: a project
following the documented setup exactly got a red `node26` for breaking a rule it
had never read. The gate is gone — not for that reason, but because a text
pattern cannot answer a question about scope
([`../../../todo/jsdoc-verification.md`](../../../todo/jsdoc-verification.md)).

**A second instance has since appeared, and it is not a convention gate.**
`fjs ci` now writes `.github/workflows/npm-publish.yml` as well
([`../publish/module.f.mjs`](../publish/module.f.mjs)), so a project that
regenerates gets a workflow that attempts to publish it to npm on every push to
`main`. Deleting the file does not opt out: the next `fjs ci` writes it again,
and `gen`'s drift check then fails on its absence. `Setup` has no field
that turns it off, for the same reason it has none for `node26` — and
`fjs run <custom-ci-module>`, which [`fjs/README.md`](../../README.md) offers as
the escape hatch for exactly this, is not one here: a custom module calls
`ci(setup)`, and `ci(setup)` is what writes the file.

That is worse than the `@typedef` gate was. A gate made a consumer's build red
for a rule they had never read; this one runs a release step against a registry
under their own package name. Nothing bad follows automatically — with no
trusted-publishing grant configured the step fails, and it carries
`continue-on-error`, so it is silent rather than harmful — but "the generator
writes an active release workflow into your repository and you cannot decline
it" is the sharpest form this question has taken, and the one that decides it.

What survives underneath is the ambiguity that let both appear: nothing in the
design says whether `fjs ci` is a shared tool or this repository's own, so the
next thing it writes unconditionally has nowhere to be told it does not belong.
A pair of `@module` gates was very nearly added to `node26` for exactly that
reason.

P5 while no project outside this repository is known to run `fjs ci` at all;
the publishing workflow is the reason that would stop being the right priority
the moment one does.

### Proposal

No design agreed; the choice is what `fjs ci` is *for*.

- **Split the job.** `nodeVersionJobs` yields the portable per-version jobs;
  this repository's convention gates — should any be built — move to a
  `nodeExtra`-style hook it passes itself. A consumer keeps the documented
  `cov`/`gen` contract and gets none of our conventions. Under this
  option the publishing workflow becomes something a consumer asks for rather
  than something they receive — a `Setup` field, or a separate export
  `ci(setup)` does not call.
- **Or narrow the claim.** Keep the job as it is and say in
  [`fjs/README.md`](../../README.md) and [`../README.md`](../README.md) that
  `fjs ci` generates *this* repository's workflow, and that other projects
  should use `fjs run <custom-ci-module>` — which `fjs/README.md` already offers
  as the escape hatch.

The first is the better API and the second is honest about today's. Either
settles it; leaving both claims standing is what should not continue. Worth
checking before choosing: whether any project outside this repository actually
runs `fjs ci`. If none does, the second option costs a paragraph and the first
is speculative generality.

### Tasks

- [ ] Decide which of the two the command is.
- [ ] Apply it, and make [`fjs/README.md`](../../README.md) and
      [`../README.md`](../README.md) agree.

### Related

- [`../node/module.f.mjs`](../node/module.f.mjs) — `node26Steps`, the job in
  question.
- [`../module.f.mjs`](../module.f.mjs) — `ci(setup)` and `canonicalJobs`, where
  the jobs are assembled and `nodeExtra` stops short.
- [`../publish/module.f.mjs`](../publish/module.f.mjs) — the publishing
  workflow, written unconditionally and with no way to decline it.
- [`../../../todo/jsdoc-verification.md`](../../../todo/jsdoc-verification.md)
  — whether a convention gate can be built at all; this issue is where one would
  belong if it can.

### History

Filed as `node26-typedef-gate-reaches-consumers.md`, reporting the `@typedef`
gate as a rule of ours that reached every consumer of `fjs ci`. The gate was
deleted under root `AGENTS.md` §6, which removes the instance and leaves the
audience question that produced it.
