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

**Blocked by:**

- [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md)

Stage 1 — removing authored TypeScript — is complete and is no longer a
blocker. It was tracked in `todo/migrate-typescript-to-mjs.md`, deleted once
finished; the extension contract it established lives in
[`fjs/fsc/README.md`](../fjs/fsc/README.md).

The initial compiler walking skeleton does not require repository source
migration and may use a small synthetic JavaScript fixture. The extension-based
compiler-compatibility migration of existing repository modules is separate and
cannot begin while authored TypeScript remains.

Stage 1 first converts the repository gradually and dependency-first:

```text
module.ts   -> module.mjs
module.f.ts -> module.f.mjs
```

During stage 1, `.f.mjs` means authored FunctionalScript-intent JavaScript; it
does not promise current compiler support. The stage also removes the
TypeScript-to-JavaScript emit path after the last TypeScript source is gone
(done in [#1520](https://github.com/functionalscript/functionalscript/pull/1520):
`prepack` emits declarations only, then re-checks against them without
emitting), cleans obsolete generated `.js`, and removes the
blanket `**/*.js` ignore so `.js` becomes authorable and trackable again (done
in [#1545](https://github.com/functionalscript/functionalscript/pull/1545); the
rule guarded only stale artifacts once nothing generated `.js`, and `**/*.js`
deliberately stays in `package.json`'s `files`).

Before stage 2 renames any repository source, complete the focused
[`f-js-package-support.md`](../fjs/ci/todo/f-js-package-support.md) prerequisite.
A standalone authored `.f.js` must be directly included in TypeScript checking,
receive a generated `.d.ts`, be included in the packed NPM artifact, and work
from a clean consumer. Stage-2 package and publish validation runs from a clean
CI checkout, so generated-output cleanup or repeated-pack safety is not part of
this prerequisite. Compiler acceptance alone is not a sufficient rename gate.

Only then does the repository compiler-compatibility migration use:

```text
module.f.mjs -> module.f.js
```

An authored `.f.js` must be accepted by the FunctionalScript parser and compiler
in the same repository revision. Migration remains incremental: select a
compiler-supported dependency-closed `.f.mjs` module or coherent group, rename
it to `.f.js`, update runtime and type references plus callers, and keep it as a
permanent end-to-end compiler regression input. Unsupported FunctionalScript
modules remain `.f.mjs` until the required compiler features land.

See [`fjs/fsc/README.md`](../fjs/fsc/README.md) for the authoritative extension
contract and migration strategy.

### CLI: an output target, not a command group (decided)

`fjs compile <input> <output>` already dispatches on the output extension
(`.json` vs. DJS — see [`fjs/djs/module.f.mjs`](../fjs/djs/module.f.mjs)). Rust
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
- [ ] Complete
      [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md),
      including direct type-checking, declaration emission, packing, and
      clean-consumer runtime/type tests.
- [ ] Verify `.js` is trackable and authored `.f.js` is a first-class package
      source before the first compiler-compatibility rename.
- [ ] Convert the first eligible dependency-closed repository module or group
      from `.f.mjs` to `.f.js` and keep it in the end-to-end compiler, proof,
      coverage, type-checking, package-runtime, and package-type-resolution test
      sets.
- [ ] Continue `.f.mjs` -> `.f.js` incrementally as compiler support grows.

### Related

- [package support for authored `.f.js`](../fjs/ci/todo/f-js-package-support.md)
  — **blocked-by prerequisite** before the first stage-2 rename.
- [`fjs/fsc/README.md`](../fjs/fsc/README.md) — the extension contract, and the
  stage-1/stage-2 boundary this migration starts from.
- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [authored `.mjs` package support](../fjs/ci/todo/f-mjs-package-support.md) —
  stage-1 validation, declaration, and package prerequisite.
- [`publishing-packages.md`](../fjs/ci/todo/publishing-packages.md) — broader
  package-publishing roadmap.
- [edag-spec](./edag-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
