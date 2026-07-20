## fjs–nanvm integration

**Priority:** P1
**Status:** open

### Problem

The MVP ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) is reached when the
`fjs` CLI parses and compiles FJS code into generated Rust code that calls
the `nanvm-lib` API, builds it with the Rust compiler, and runs the resulting
executable. This integration does **not** need to wait for everything else:
it can start as soon as a minimal subset works end-to-end (e.g. a module
whose default export is a constant), before the operators, the full parser,
and the rest of the P1 tasks are complete.

Integrating first means every later feature (operators, functions, control)
lands into an already-working pipeline and is verified end-to-end from day
one, instead of a big-bang integration at the end.

A module has no starting point of its own, so merely compiling it would not
prove much. The entry point is the module's `export default`: the generated
program evaluates it, runs it if it is a function, and prints the result to
stdout as JSON.

### CLI commands (decided)

A `vm` command group in the `fjs` CLI (following the pattern of the existing
`cas` group):

- `fjs vm build <module>` — parse + compile into a generated Rust crate that
  builds the module's value via the `nanvm-lib` API;
- `fjs vm run <module>` — `vm build`, then build and run the generated crate
  with cargo; the program evaluates `export default` (running it if it is a
  function) and prints the result to stdout as JSON.

The group is named `vm` (not `nanvm`) because the CLI names the stable
contract — running FunctionalScript on a VM — not one VM implementation or
one execution path; the future self-hosted `nanvm` executable and the
interpreter path fit the same group.

### Tasks

- [ ] Define the layout of the generated crate (where it is written, how it
      depends on `nanvm-lib`, how builds are cached — see the toolchain open
      question in [mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md#open-questions)).
- [ ] Add the `vm` command group (`vm build`, `vm run`) to the `fjs` CLI.
- [ ] Prove the pipeline with a minimal subset: a constant default export,
      parsed by `fjs`, generated as Rust, built and run by cargo, result
      printed to stdout as JSON.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the self-hosted `nanvm` executable (post-MVP).
- [ast-spec](./ast-spec.md) — the schema of the code-describing `Any`; the
  `Function` constructor contract.
