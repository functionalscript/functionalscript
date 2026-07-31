# Decouple the FJS MCP server from CAS

**Priority:** P3
**Status:** open

### Problem

Protocol-related modules currently live in unrelated top-level locations under
`fjs/`. The general Model Context Protocol implementation lives in `fjs/mcp/`,
while the CAS-specific MCP server — the concrete server the `fjs mcp` / `m`
CLI command runs — lives separately in `fjs/cas/mcp/` (with its Evo-specific
tool registry nested further, in `fjs/cas/evo/mcp/`). Keeping the generic
protocol machinery and its one concrete FunctionalScript server in unrelated
trees makes the structure harder to discover and obscures their relationship.

Beyond the directory split, the FJS MCP server is also coupled to CAS more
tightly than it needs to be: today it implements *only* CAS/Evo functions, but
it is expected to grow more tool sets over time, and nothing about "the FJS
MCP server" should be inherently CAS-specific.

Directory paths are currently part of the published package API because the
package does not define an exports map. Moving these modules therefore breaks
existing consumer imports and must be treated as a breaking change rather than
only as an internal path update.

### Proposal

Create `fjs/protocol/` as the common directory for modules that implement or
describe communication protocols, generic and reusable across any server.

Move the general MCP protocol implementation — message schemas, the
lifecycle/capability state machine, the tool-registry builders, and the stdio
transport (today's `fjs/mcp/`) — to `fjs/protocol/mcp/`. This is the
transport-independent, server-agnostic layer: nothing in it is specific to
CAS, and it is what any future MCP server (not just this one) builds on.

`fjs/cas/` stays exactly what it is: communication with CAS storage (today,
filesystem-backed).

The directory `fjs/mcp/` vacates becomes *the* FunctionalScript MCP server —
`fjs/cas/mcp/` moves there. The name now matches the `fjs mcp` / `m` CLI
command 1:1, the same way `fjs/cli/` matches `fjs`'s command dispatch:

```text
fjs/mcp/         (general, transport-agnostic)   -> fjs/protocol/mcp/
fjs/cas/mcp/     (the FJS MCP server)             -> fjs/mcp/
```

Decouple the FJS MCP server's composition root from the tool sets it happens
to serve today, so a future non-CAS tool set can land as a new sibling without
touching the existing ones:

- `fjs/mcp/module.f.ts` — the server itself: session config
  (`McpConfig`), the top-level entry point the CLI runs (wiring `mcpStep` +
  `stdioTransport` from `fjs/protocol/mcp/`), and composing the tool
  registries below into one `McpHandlers`. Nothing CAS- or Evo-specific lives
  here — it only knows about tool *registries*, not what is in them.
- `fjs/mcp/cas/` — the `cas_add` / `cas_get` / `cas_list` tool registry
  (today's tool-specific portion of `fjs/cas/mcp/module.f.ts`), importing
  `fjs/cas/` for the actual store operations.
- `fjs/mcp/evo/` — the `evo_*` tool registry (today's `fjs/cas/evo/mcp/`),
  already generic in an abstract `Evo<O>` rather than depending on `fjs/cas/`
  directly.

```text
fjs/cas/evo/mcp/ (Evo tool registry) -> fjs/mcp/evo/
```

Keep data formats and media types under `fjs/media/`; move only modules whose
primary responsibility is protocol behavior, messages, operations, or
transport-independent communication semantics. Besides MCP itself, identify
any other existing `fjs/` module whose primary responsibility is a protocol —
e.g. the JSON-RPC 2.0 envelope/dispatcher MCP is layered on top of currently
lives at `fjs/media/json/rpc/`, nested under the JSON *format* tree even
though JSON-RPC is a protocol, not a data format — and move it under
`fjs/protocol/` too.

The move should preserve module boundaries and behavior. Update imports,
documentation, TODO links, package metadata, generated files, and other path
references as required.

Because published import paths change, the implementation PR must add a
`CHANGELOG.md` entry beginning with the exact required
`**BREAKING CHANGES:**` prefix and state the old and new import paths so
consumers can migrate.

### Tasks

- [ ] Create `fjs/protocol/`.
- [ ] Move the general MCP protocol implementation from `fjs/mcp/` to `fjs/protocol/mcp/`.
- [ ] Move the FJS MCP server `fjs/cas/mcp/` into the now-vacated `fjs/mcp/`,
      splitting it into `fjs/mcp/module.f.ts` (server composition root: config
      + CLI entry point + registry wiring) and `fjs/mcp/cas/` (the `cas_*`
      tool registry), so `fjs/mcp/` matches the `fjs mcp` CLI command and is
      not inherently CAS-specific.
- [ ] Move the Evo tool registry `fjs/cas/evo/mcp/` to `fjs/mcp/evo/`.
- [ ] Identify any other existing modules under `fjs/` whose primary responsibility is a protocol.
- [ ] Move any other identified protocol modules to corresponding subdirectories under `fjs/protocol/`.
- [ ] Update all imports and path references, including references to `fjs/mcp/...`
      (old, general), `fjs/cas/mcp/...`, and `fjs/cas/evo/mcp/...`.
- [ ] Update documentation and TODO links that reference the old locations.
- [ ] Add a `CHANGELOG.md` entry beginning with `**BREAKING CHANGES:**` that announces every published import-path migration and lists the corresponding old and new paths.
- [ ] Regenerate repository-generated files as required.
- [ ] Run the full TypeScript and FunctionalScript test suites.

### Related

- [Group FunctionalScript subdirectories by concern](./group-fs-subdirectories-by-concern.md) — broader directory-restructuring proposal that this protocol-specific task should remain consistent with.
