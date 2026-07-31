# Group protocol modules

**Priority:** P3
**Status:** open

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

- [ ] Create `fjs/protocol/`.
- [ ] Consolidate `fjs/cas/mcp/` into the general `fjs/mcp/` module tree.
- [ ] Move the combined `fjs/mcp/` implementation to `fjs/protocol/mcp/`.
- [ ] Identify any other existing modules under `fjs/` whose primary responsibility is a protocol.
- [ ] Move any other identified protocol modules to corresponding subdirectories under `fjs/protocol/`.
- [ ] Update all imports and path references, including references to both `fjs/mcp/...` and `fjs/cas/mcp/...`.
- [ ] Update documentation and TODO links that reference the old locations.
- [ ] Add a `CHANGELOG.md` entry beginning with `**BREAKING CHANGES:**` that announces every published import-path migration and lists the corresponding old and new paths.
- [ ] Regenerate repository-generated files as required.
- [ ] Run the full TypeScript and FunctionalScript test suites.

### Related

- [Group FunctionalScript subdirectories by concern](./group-fs-subdirectories-by-concern.md) — broader directory-restructuring proposal that this protocol-specific task should remain consistent with.
