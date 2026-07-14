## options-edsl. Declarative options in the CLI eDSL

**Priority:** P3
**Status:** open

### Problem

`Command` (`fs/cli/module.f.ts`) hands every handler a raw
`args: readonly string[]` and has no concept of a named option. Any command
that wants a flag has to hand-parse it:

```ts
const verify = args.includes('--verify')
const [hashCBase32, path, ...rest] = args.filter(a => a !== '--verify')
```

(the `cas get --verify` prototype in PR #1277, closed for exactly this
reason). Hand-parsing is stringly-typed and wrong in every direction:

- a typo (`--verfy`) is not rejected — it silently becomes a positional
  argument and surfaces as a misleading arity or invalid-hash error;
- the option is invisible to the help table `dispatch` renders; the only
  place to document it is free text in `description`;
- every next flag copies the same pattern — one divergent parser per
  command, with no compile-time link between what is parsed and what the
  handler reads;
- non-declarative parsing must keep `help` and documentation in sync with
  the parser by hand: the parsing code, the `description` text, and any
  README all state the option independently, and nothing detects when they
  drift apart. With a declarative option, the declaration *is* the single
  source the help and docs are generated from.

### Proposal

Extend the eDSL so a command *declares* its positional parameters and named
options, and the `fs/cli` layer owns parsing, validation, help rendering,
and handing the handler a typed record instead of a raw array.

Design first, then migrate. The design should settle:

- the declaration form — e.g. `Command` gaining `params`/`options` fields
  that `dispatch` validates and folds into the help text;
- parsing rules: `--flag` booleans, `--key value` and/or `--key=value`,
  rejection of unknown options, a `--` positional terminator;
- typing: the handler's input type should be *derived* from the
  declaration, not asserted. Consider rtti structs as the declaration
  language — the CAS MCP layer already declares tool args as rtti structs
  used for both `inputSchema` and `validate`; one declaration could drive
  CLI parsing and help the same way. Whether that struct should be shared
  across transports is evaluated in
  [fs/cas command-architecture](../../cas/todo/command-architecture.md);
- coordination with [positional-arity-check](./positional-arity-check.md)
  (arity validation is subsumed by declared positionals) and
  [fs/fjs 66g-fjs-run-commands](../../fjs/todo/66g-fjs-run-commands.md)
  (the `Commands` reshaping this should ride along with).

### Tasks

- [ ] Design the declaration shape and parsing rules; record the decision
      in this file or `fs/cli/README.md`.
- [ ] Implement parsing, validation, and help rendering in `fs/cli` with
      proof coverage.
- [ ] Migrate existing commands; retire the hand-rolled arity checks
      ([positional-arity-check](./positional-arity-check.md)).
- [ ] `npx tsc`, `fjs t`.

### Related

- [positional-arity-check](./positional-arity-check.md) — subsumed by
  declared positional parameters.
- [dispatch-help-rendering](./dispatch-help-rendering.md) — the help
  rendering that declared options must plug into.
- `fs/fjs/todo/66g-fjs-run-commands.md` — the `Commands` reshaping to
  coordinate with.
- [fs/cas 66g-cas-get-verify-option](../../cas/todo/66g-cas-get-verify-option.md)
  — first feature blocked on this.
- [fs/cas command-architecture](../../cas/todo/command-architecture.md) —
  the transport-neutral command declaration this may share a language with.
