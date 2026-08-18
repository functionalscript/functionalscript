## Samples

**Priority:** P3
**Status:** open

### Problem

Nothing in the repository shows what writing FunctionalScript actually looks
like, end to end, to someone who has not read the source.

- The root [README.md](../README.md) explains what FunctionalScript *is*
  (a purely functional subset of JavaScript), lists the `fjs` CLI commands,
  and documents CAS and MCP usage — but contains no FunctionalScript code.
  The nearest thing to a language example is the specification draft in
  [spec/README.md](../spec/README.md), which is a spec, not a tutorial.
- [demo/README.md](./demo/README.md) has the examples a newcomer wants
  (`math.f.js`, shared-reference data modules, a test module), but it is a
  presentation script parked under `todo/`, not linked from anywhere a
  reader would find it, and parts of it are stale.
- `fjs/djs/examples/` holds two fixture modules consumed by proofs, not
  runnable samples.

Two external reports asked for exactly this, two years apart:
[#233](https://github.com/functionalscript/functionalscript/issues/233)
(a `samples/` directory with a README on how to run each sample, and a list
of candidate programs) and
[#485](https://github.com/functionalscript/functionalscript/issues/485)
("I don't really understand how this library works … Do you have any
examples of use?").

### Proposal

A top-level `samples/` directory: one subdirectory per sample, each with a
`README.md` stating what it demonstrates and the exact command to run it,
plus a `samples/README.md` index linked from the root `README.md`.

Constraints that make the samples worth maintaining rather than a second
thing to keep in sync:

- **Samples run in CI.** Each sample exports a `proof` or is driven by a
  scenario test, so a language or CLI change that breaks a sample fails the
  build. A sample that is not executed will rot.
- **Samples use only shipped features.** The parser is still a work in
  progress; a sample that needs an unimplemented feature belongs in
  [spec/](../spec/README.md) as a spec example, not in `samples/`.
- **The root README embeds the smallest one** — a reader should see
  FunctionalScript code without leaving the front page.

Candidate samples, from #233:

- hello world;
- 99 bottles of beer (recursion with a base case);
- quicksort over numbers (the `filter`-based one-liner);
- an expression calculator (`+ - / %`, parentheses, a few functions);
- a small parser (URL or date-time);
- consuming a FunctionalScript module from an existing TypeScript project;
- consuming a FunctionalScript module from an existing JavaScript project.

The last two are the ones that answer #485 directly — the claim that `.f.mjs`
modules import into ordinary TS/JS with no build step is the project's main
selling point and is currently unillustrated.

Salvage [demo/README.md](./demo/README.md) rather than rewriting from
scratch: its `math.f.js` and shared-reference examples are the seed of the
first two samples. Once its content lives in `samples/` and the root README,
delete it.

### Tasks

- [ ] Decide the sample set for a first pass (hello world, quicksort,
      consume-from-TS) and the directory layout.
- [ ] Add `samples/README.md` as an index; link it from the root
      [README.md](../README.md).
- [ ] Embed the smallest sample inline in the root README.
- [ ] Make each sample executable by the test suite so CI catches
      regressions.
- [ ] Migrate the usable parts of [demo/README.md](./demo/README.md), then
      delete it.
- [ ] Add the remaining candidates from #233 as features land.

### Related

- [GitHub issue #233](https://github.com/functionalscript/functionalscript/issues/233)
  — samples directory request.
- [GitHub issue #485](https://github.com/functionalscript/functionalscript/issues/485)
  — README does not explain how the library is used.
- [fjs/website/todo/generate-website.md](../fjs/website/todo/generate-website.md)
  — the `page.f.mjs` convention and README→HTML publishing; samples should
  feed the website rather than duplicate it.
- [demo/README.md](./demo/README.md) — existing examples to salvage.
