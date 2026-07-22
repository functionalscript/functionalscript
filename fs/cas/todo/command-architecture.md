## command-architecture. Design a transport-agnostic CAS command architecture

**Priority:** P3
**Status:** open

### Problem

CAS functionality is exposed through two transports — the CLI
(`fs/cas/cli/module.f.ts`) and the MCP server (`fs/cas/mcp/module.f.ts`) —
and each wires its own logic directly onto the store primitives in
`fs/cas/module.f.ts`. There is no defined notion of a *CAS command*: no
shared command set, no typed input/output contracts, no common error
taxonomy, and no stated policy of which transport exposes which operation.

The consequence is that every new feature is pumped into each transport
separately. PR #1277 (closed) is the motivating example: read-time hash
verification was added as a hand-parsed `--verify` CLI flag *and* a
parallel `verify: true` MCP argument — two ad hoc patches around one core
function, each with its own error wording and flow. A third transport
(a Web API server, [web-api-server](./web-api-server.md)) would turn the
duplication into triplication.

[66k-cas-cli-mcp-shared-core](./66k-cas-cli-mcp-shared-core.md) already
catalogues the existing duplication, but it is written as a mechanical
dedup refactor of the three current operations. What is missing is the
design layer above it: what the command set *is*, before any refactoring.

### Proposal

**This is a design task, not an implementation task.** The deliverable is a
reviewed design document (in `fs/cas/README.md` or a dedicated doc under
`fs/cas/`); implementation is then re-filed as follow-up issues sized from
the design.

The design should answer:

1. **What a CAS command is** — a named operation with a typed input, a
   typed output, and errors drawn from a shared taxonomy (invalid hash /
   not found / too large / hash mismatch / …), defined independently of any
   transport and generic in the effect set (`Cas<O>` in, `Effect` out).
2. **The command set** — today's `add`, `get`, `list`; planned commands
   such as the batch scrub ([66g-cas-verify-command](./66g-cas-verify-command.md)),
   read-time verification ([66g-cas-get-verify-option](./66g-cas-get-verify-option.md)),
   and the Evo operations (implemented as their own transport,
   [`fs/cas/evo`](../evo/), rather than folded into this command set — a
   candidate for reconciling once this design lands).
3. **The exposure matrix** — which transports (CLI, MCP,
   [Web API](./web-api-server.md)) expose which commands, with what
   restrictions. Known constraint to encode: file-path `add` is CLI-only —
   the MCP server never opens a client-named path (see the invariant in
   `fs/cas/mcp/README.md`); the same rule presumably binds a Web API.
4. **How one declaration drives every adapter.** An idea to evaluate, not
   prescribe: rtti structs are already the MCP argument schema (deriving
   both `inputSchema` and `validate`); the same struct could drive CLI
   option parsing ([fs/cli options-edsl](../../cli/todo/options-edsl.md))
   and Web API request validation, making the command declaration the
   single source of truth for names, arguments, help, and error messages.
5. **Where the shared layer lives** (e.g. `fs/cas/commands/`) and its
   layering rules: commands depend on the store core and stay
   effect-generic; transports depend on commands; the store core never
   depends on a transport.

### Tasks

- [ ] Inventory the current duplication (start from the list in
      [66k-cas-cli-mcp-shared-core](./66k-cas-cli-mcp-shared-core.md)).
- [ ] Write and review the design covering points 1–5.
- [ ] Re-scope [66k-cas-cli-mcp-shared-core](./66k-cas-cli-mcp-shared-core.md)
      as the implementation of the chosen design, or fold it in and delete it.
- [ ] File implementation follow-ups; unblock
      [66g-cas-get-verify-option](./66g-cas-get-verify-option.md) and
      [web-api-server](./web-api-server.md).

### Related

- [66k-cas-cli-mcp-shared-core](./66k-cas-cli-mcp-shared-core.md) — the
  implementation follow-up, now blocked on this design.
- [fs/cli options-edsl](../../cli/todo/options-edsl.md) — the CLI-side
  declaration mechanism a shared command declaration would plug into.
- [web-api-server](./web-api-server.md) — the third transport this design
  must anticipate.
- [`fs/cas/evo`](../evo/) — implemented as its own MCP server rather than
  through this (still undesigned) shared command layer; a candidate to
  reconcile once this design lands.
- PR #1277 (closed) — the motivating ad hoc feature patch.
