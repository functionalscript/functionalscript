# Group protocol modules

**Priority:** P3
**Status:** done

### Problem

Protocol-related modules currently live in unrelated top-level locations under
`fjs/`. The general Model Context Protocol implementation lives in `fjs/mcp/`,
while the CAS-specific MCP server lives separately in `fjs/cas/mcp/`. Keeping
parts of the same protocol in different directory trees makes the structure
harder to discover and obscures their relationship.

Directory paths are currently part of the published package API because the
package does not define an exports map. Moving `fjs/mcp/...` therefore breaks
existing consumer imports and must be treated as a breaking change rather than
only as an internal path update.

### Proposal

Create `fjs/protocol/` as the common directory for modules that implement or
describe communication protocols.

First consolidate the CAS-specific MCP implementation from `fjs/cas/mcp/` into
the general `fjs/mcp/` module tree. Then move the combined MCP implementation to
`fjs/protocol/mcp/`:

```text
fjs/cas/mcp/ --\
                 -> fjs/mcp/ -> fjs/protocol/mcp/
fjs/mcp/ -----/
```

The final `fjs/protocol/mcp/` tree should preserve clear internal separation for
CAS-specific behavior while sharing the common MCP protocol definitions and
infrastructure.

Keep data formats and media types under `fjs/media/`; move only modules whose
primary responsibility is protocol behavior, messages, operations, or
transport-independent communication semantics.

The move should preserve module boundaries and behavior. Update imports,
documentation, TODO links, package metadata, generated files, and other path
references as required.

Because published import paths change, the implementation PR must add a
`CHANGELOG.md` entry beginning with the exact required
`**BREAKING CHANGES:**` prefix and state the old and new import paths so
consumers can migrate.

### Tasks

- [x] Create `fjs/protocol/`.
- [x] Consolidate `fjs/cas/mcp/` into the general `fjs/mcp/` module tree.
- [x] Move the combined `fjs/mcp/` implementation to `fjs/protocol/mcp/` — the
      CAS-specific adapter landed at `fjs/protocol/mcp/cas/` (with the Evo
      adapter, formerly `fjs/cas/evo/mcp/`, nested at
      `fjs/protocol/mcp/cas/evo/`), keeping clear internal separation from the
      shared MCP protocol definitions and infrastructure at
      `fjs/protocol/mcp/module.f.ts` / `fjs/protocol/mcp/stdio/`.
- [x] Identify any other existing modules under `fjs/` whose primary responsibility is a protocol.
      — `fjs/media/json/rpc/`, the JSON-RPC 2.0 envelope/dispatcher MCP layers
      on top of, is a protocol module, not a media format.
- [x] Move any other identified protocol modules to corresponding subdirectories
      under `fjs/protocol/` — `fjs/media/json/rpc/` → `fjs/protocol/json_rpc/`.
- [x] Update all imports and path references, including references to both `fjs/mcp/...` and `fjs/cas/mcp/...`.
- [x] Update documentation and TODO links that reference the old locations.
- [x] Add a `CHANGELOG.md` entry beginning with `**BREAKING CHANGES:**` that announces every published import-path migration and lists the corresponding old and new paths.
- [x] Regenerate repository-generated files as required.
- [x] Run the full TypeScript and FunctionalScript test suites.

### Related

- [Group FunctionalScript subdirectories by concern](./group-fs-subdirectories-by-concern.md) — broader directory-restructuring proposal that this protocol-specific task should remain consistent with.
