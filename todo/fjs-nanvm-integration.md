## fjs–nanvm integration

**Priority:** P1
**Status:** open

### Problem

The MVP ([mvp-roadmap](../nanvm-lib/todo/mvp-roadmap.md)) is reached when the
`fjs` CLI parses and compiles FJS code and runs it by sending the serialized
AST to the `nanvm` executable. This integration does **not** need to wait for
everything else: it can start as soon as a minimal AST subset works end-to-end
(e.g. a module whose default export is a constant), before the operators, the
full parser, and the rest of the P1 tasks are complete.

Integrating first means every later feature (operators, functions, control)
lands into an already-working pipeline and is verified end-to-end from day
one, instead of a big-bang integration at the end.

An AST has no starting point of its own, so merely loading it would not prove
much. The entry point is the module's `export default`: `nanvm` evaluates it,
runs it if it is a function, and prints the result to stdout as JSON.

### CLI commands (decided)

A `vm` command group in the `fjs` CLI (following the pattern of the existing
`cas` group):

- `fjs vm build <module>` — parse + compile into a serialized AST;
- `fjs vm run <module>` — `vm build`, then hand the serialized AST to the
  `nanvm` executable, which evaluates `export default` (running it if it is a
  function) and prints the result to stdout as JSON.

The group is named `vm` (not `nanvm`) because the CLI names the stable
contract — running FunctionalScript on a VM via the serialized AST — not one
VM implementation; a future VM fits the same group.

### Tasks

- [ ] Create the `nanvm` executable
      ([console-program](../nanvm-lib/todo/console-program.md)).
- [ ] Define how `fjs vm run` hands the serialized AST to `nanvm`
      (file, stdin, …).
- [ ] Add the `vm` command group (`vm build`, `vm run`) to the `fjs` CLI.
- [ ] Prove the pipeline with a minimal AST subset: a constant default export,
      parsed by `fjs`, executed by `nanvm`, result printed to stdout as JSON.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the `nanvm` executable.
- [ast-spec](./ast-spec.md) — the minimal subset still flows through the
  agreed schema.
