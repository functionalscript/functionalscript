# Group protocol modules

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
CAS.

Then consolidate the CAS-specific MCP server — today's `fjs/cas/mcp/`,
together with the Evo-specific tool registry nested inside it at
`fjs/cas/evo/mcp/` — into the directory `fjs/mcp/` vacates. `fjs/mcp/` becomes
*the* FunctionalScript MCP server: the concrete implementation the `fjs mcp` /
`m` CLI command runs, exposing CAS and Evo as tools. The name now matches the
command 1:1, the same way `fjs/cli/` matches `fjs`'s command dispatch. It
imports the generic pieces from `fjs/protocol/mcp/` the same way any other
future MCP server would:

```text
fjs/mcp/         (general, transport-agnostic)   -> fjs/protocol/mcp/
fjs/cas/mcp/     (the CAS/Evo server) ----\
fjs/cas/evo/mcp/ (its Evo tool registry) --+->     fjs/mcp/ (fjs/mcp/evo/)
```

The final `fjs/mcp/` tree keeps the Evo-specific tool registry nested (as
`fjs/mcp/evo/`, mirroring the CAS/Evo layering, `fjs/cas/evo/`) while every
tool it registers is served together from one process, one `fjs mcp` command.

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
- [ ] Consolidate the CAS-specific MCP server `fjs/cas/mcp/` (with its Evo tool
      registry `fjs/cas/evo/mcp/` nested inside, e.g. as `fjs/mcp/evo/`) into
      the now-vacated `fjs/mcp/`, so `fjs/mcp/` matches the `fjs mcp` CLI command.
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
