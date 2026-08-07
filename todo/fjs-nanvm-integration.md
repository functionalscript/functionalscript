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

### Repository compiler-compatibility migration

**Blocked by:** [migrate authored TypeScript to `.mjs`](../fjs/ci/todo/migrate-typescript-to-mjs.md)

The initial compiler walking skeleton does not require repository source
migration and may use a small synthetic JavaScript fixture. The extension-based
compiler-compatibility migration of existing FunctionalScript modules is a
separate step and must not begin while authored TypeScript remains in the
repository.

First complete the repository-wide source-language migration:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
```

That migration is gradual and dependency-first: `.ts` / `.f.ts` files with no
authored TypeScript dependencies migrate first, then their callers, until no
authored TypeScript remains. `.f.mjs` during that stage means authored
FunctionalScript-intent JavaScript; it does not promise that the current
FunctionalScript compiler accepts the module.

Only after that prerequisite is complete does this TODO start the
compiler-compatibility migration:

```text
module.f.mjs -> module.f.js
```

At that point `.f.js` is available as an unambiguous authored-source marker
because TypeScript no longer emits generated `.f.js` from `.f.ts` source. An
authored `.f.js` module must be accepted by the FunctionalScript parser and
compiler in the same repository revision.

Compiler-compatibility migration is incremental. Select a dependency-closed
`.f.mjs` module or coherent group whose complete syntax and required dependency
graph are supported by the current compiler, rename it to `.f.js`, update its
runtime and type references plus callers, and keep it as a permanent end-to-end
compiler regression input. Unsupported FunctionalScript modules remain
`.f.mjs` until the needed compiler features land.

See [`fjs/fsc/README.md`](../fjs/fsc/README.md) for the extension contract and
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
- [ ] Prove the pipeline with a minimal synthetic JavaScript FunctionalScript
      subset: a constant default export compiled by `fjs` to `.rs`, built and
      run by cargo, with the result printed to stdout as JSON.
- [ ] Complete [migrate authored TypeScript to `.mjs`](../fjs/ci/todo/migrate-typescript-to-mjs.md).
- [ ] After that dependency is complete, convert the first eligible
      dependency-closed repository module or group from `.f.mjs` to `.f.js` and
      keep it in the end-to-end compiler, proof, coverage, type-checking,
      package-runtime, and package-type-resolution test sets.
- [ ] Continue `.f.mjs` -> `.f.js` incrementally as compiler support grows.

### Related

- [migrate authored TypeScript to `.mjs`](../fjs/ci/todo/migrate-typescript-to-mjs.md)
  — **blocked-by prerequisite** for repository compiler-compatibility migration.
- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [`.f.mjs` test and coverage support](../fjs/emergent_testing/todo/f-mjs-test-and-coverage.md)
  — proof-discovery and cross-runner coverage support used by stage 1.
- [authored `.f.mjs` package support](../fjs/ci/todo/f-mjs-package-support.md) —
  validation, declaration, and package support used by stage 1.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — broader P3
  package-publishing roadmap and shared authored/generated extension convention.
- [ast-spec](./ast-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
