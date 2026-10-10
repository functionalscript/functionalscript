## publish-only-a-new-version. Tell a republish apart from a failed publish

**Priority:** P3
**Status:** open

### Problem

The generated publish workflow's last step is

```json
{ "run": "npm publish --provenance", "continue-on-error": true }
```

and `continue-on-error` is doing two jobs at once. Most pushes to `main` do not
move `package.json`'s version, npm answers a republish of an existing version
with a 403, and that is the expected outcome — the version is the single source
of truth and a push that does not change it is not a release
([`publishing-packages.md`](./publishing-packages.md), "Updating packages").

But the flag does not know which 403 it swallowed. An expired trusted-publishing
grant, a provenance rejection, a registry outage and a genuinely broken package
all end the same way: a green workflow and no package. The one failure mode this
workflow exists to report is the one it cannot.

It is also the only `continue-on-error` in either generated workflow, which is
why `fjs/ci/common/module.f.mjs` admits the field as the literal `true` rather
than as a boolean — there is one step it is for.

### Evidence

Release 0.53.0 (#2401) showed the case in full. Its first `publish-npm` run
(attempt 1 of
[run 36686949183](https://github.com/functionalscript/functionalscript/actions/runs/36686949183))
signed a provenance statement and then failed the PUT with
`npm error 404 Not Found - PUT https://registry.npmjs.org/functionalscript`
— the trusted publisher on npm did not yet name the renamed workflow — and
the workflow reported green. Nothing was published. Attempt 2, re-run by hand
after the setting was changed, printed `+ functionalscript@0.53.0`. A reader
of the Actions page cannot tell the two apart.

### Proposal

Make "already published" a decision the workflow takes rather than an error it
absorbs, so every other failure stays red. Sketch, not a design:

- ask the registry for the published versions of the package under test, and
  run the publish step only when `package.json`'s version is not among them;
- drop `continue-on-error` once the publish only runs for a version that is new,
  and narrow `stepSchema` back if nothing else needs the field.

The comparison wants the tool that parses what it checks rather than a pattern
over `npm view` output (root [`AGENTS.md`](../../../AGENTS.md) §6) — this
repository already has a JSON reader and a semantic-version comparison. The
generator itself reads no `package.json` today — `ci` in `fjs/ci/module.f.mjs`
probes only `Cargo.toml`, and the compiler pin is `typescript` in
`fjs/ci/config/module.f.js`. What it must not become is a shell pipeline in a
generated `run:` line.

Open question the design has to answer first: a step that runs conditionally
needs `if:`, which neither `stepSchema` nor anything else in the generator
models today. Adding it is a wider change than this issue — an `if:` is a small
expression language — so a two-step shape (decide in one step, publish in the
next) may be the cheaper answer, or may not.

### Tasks

- [ ] Decide how the workflow learns whether the version is already published.
- [ ] Run the publish only for a new version. When maintenance publishing is
      implemented, cover the selected release line as well as main; coordinate
      with [maintenance-release-publishing.md](./maintenance-release-publishing.md).
- [ ] Remove `continue-on-error` and, if it is then unused, its schema entry.
- [ ] Prove that a failing publish is red.

### Related

- [`publishing-packages.md`](./publishing-packages.md) — regular and planned
  maintenance publishing; the new-version check remains open.
