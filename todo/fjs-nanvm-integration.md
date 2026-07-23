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
- [ ] Prove the pipeline with a minimal subset: a constant default export,
      compiled by `fjs` to `.rs`, built and run by cargo, result printed to
      stdout as JSON.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` crate (post-MVP).
- [ast-spec](./ast-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
