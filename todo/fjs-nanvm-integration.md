## fjs–nanvm integration

**Priority:** P1
**Status:** open

### Problem

The MVP ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) is reached when
`fjs compile` can emit Rust code that calls the `nanvm-lib` API, and a
harness crate builds and runs the generated code with cargo. This
integration does **not** need to wait for everything else: it can start as
soon as a minimal subset works end-to-end (e.g. a module whose default
export is a constant), before the operators, the full parser, and the rest
of the P1 tasks are complete.

Integrating first means every later feature (operators, functions, control)
lands into an already-working pipeline and is verified end-to-end from day
one, instead of a big-bang integration at the end.

A module has no starting point of its own, so merely compiling it would not
prove much. The entry point is the module's `export default`: the harness
evaluates it, runs it if it is a function, and prints the result to stdout
as JSON.

### Repository source selection

The first integration does not imply that every existing `.f.ts` module is
accepted by the new parser. `.f.ts` is the broader authored
FunctionalScript-intent source set and may contain TypeScript syntax or
FunctionalScript features that are not implemented yet.

Use `.f.mjs` for authored modules whose complete syntax is accepted by the
current parser and compiler. Types in these modules are expressed with JSDoc,
not TypeScript syntax. The initial walking skeleton may start with a minimal
synthetic `.f.mjs` fixture before repository-wide `.mjs` infrastructure is
complete, because that fixture does not enter the published runtime graph.

Before converting the first existing repository module, complete both:

- [`.f.mjs` test and coverage support](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md),
  so the rename cannot silently remove internal proofs or coverage;
- the authored-`.mjs` work in
  [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md), including
  TypeScript checking, package inclusion for `.mjs` and `.d.mts`, declaration
  emission, and package import tests.

After those prerequisites, select a dependency-closed module or coherent group:
every relative FunctionalScript runtime dependency imported by the group must
already be `.f.mjs` or be converted in the same change. Authored `.f.mjs` must
not import unmigrated `.f.ts` or generated `.f.js`; package emission does not
rewrite authored `.mjs` imports. Rename the group, update its importers, and use
it as an end-to-end compiler input. If the required dependency closure is not
yet supported, postpone that group and choose a smaller eligible leaf.

Repository migration then continues independently, one dependency-closed group
at a time, as parser features land. It is neither part of one large PR nor a
gate on the initial synthetic walking skeleton. See
[`fjs/fsc/README.md`](../fjs/fsc/README.md) for the extension contract and
migration strategy.

### CLI: an output target, not a command group (decided)

`fjs compile <input> <output>` already dispatches on the output extension
(`.json` vs. DJS — see [`fjs/djs/module.f.ts`](../fjs/djs/module.f.ts)). Rust
code generation is a third branch, selected by the `.rs` extension:

- `fjs compile <module> <output>.rs` — parse + compile into a generated Rust
  module that builds the module's value via the `nanvm-lib` API.

`fjs` never invokes cargo; building and running the generated code is an
ordinary cargo workflow in a Rust project (the harness in this repo, the
`nanvm` crate, or a user's own crate). The previously proposed
`fjs vm build` / `fjs vm run` command group is superseded by this: no new
CLI surface, and no Rust toolchain orchestration in the npm-shipped tool.
The ergonomic single command ("run my FJS on the VM") arrives as the
self-hosted `nanvm` crate
([console-program](../nanvm-lib/todo/console-program.md)), which interprets
via the `Function` constructor — no rustc at the user's run time.

### Tasks

- [ ] Add the `.rs` branch to `fjs compile`: a generated Rust **module**
      exposing the compiled module's value (e.g.
      `pub fn module<A: IVm>() -> Any<A>`), not a `main`.
- [ ] Create the harness: a crate (or generated tests in `nanvm-lib`) with a
      thin `main` that evaluates a generated module's `export default` and
      prints the result as JSON; wire it into CI via `cargo test`.
- [ ] Define the convention for generated module imports (`use` paths,
      file/directory layout — see the open question in
      [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md#open-questions)).
- [ ] Prove the pipeline with a minimal synthetic `.f.mjs` subset: a constant
      default export compiled by `fjs` to `.rs`, built and run by cargo, with
      the result printed to stdout as JSON.
- [ ] Complete
      [`.f.mjs` test and coverage support](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md).
- [ ] Complete the authored-`.mjs` TypeScript-checking, package-inclusion,
      declaration-emission, mixed-source validation, and package-test tasks in
      [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md).
- [ ] Convert the first eligible dependency-closed repository module or group
      from `.f.ts` to `.f.mjs` and keep it in the end-to-end compiler, proof,
      coverage, type-checking, and package test sets.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [`.f.mjs` test and coverage support](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — proof-discovery and coverage prerequisite for the first repository
  conversion.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — authored
  `.mjs` validation, declaration emission, package inclusion, mixed-source
  import rules, and package tests.
- [ast-spec](./ast-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
