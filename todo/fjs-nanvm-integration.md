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

### Tasks

- [ ] Create the `nanvm` executable
      ([console-program](../nanvm-lib/todo/console-program.md)).
- [ ] Define how `fjs` invokes `nanvm` and hands over the serialized AST
      (file, stdin, …).
- [ ] Add an `fjs` CLI subcommand that parses/compiles a module and sends the
      serialized AST to `nanvm`.
- [ ] Prove the pipeline with a minimal AST subset: a constant default export,
      parsed by `fjs`, executed by `nanvm`, result printed.

### Related

- [nanvm-lib/todo/mvp-roadmap.md](../nanvm-lib/todo/mvp-roadmap.md) — MVP
  definition and task list.
- [nanvm-lib/todo/console-program.md](../nanvm-lib/todo/console-program.md) —
  the `nanvm` executable.
- [ast-spec](./ast-spec.md) — the minimal subset still flows through the
  agreed schema.
