# Group protocol modules

**Priority:** P3
**Status:** open

### Problem

Protocol-related modules currently live in unrelated top-level locations under
`fjs/`. For example, the Model Context Protocol implementation lives in
`fjs/mcp/`. As more protocols are added, placing each one at the top level makes
the directory structure harder to scan and does not clearly distinguish
protocol implementations from other modules.

### Proposal

Create `fjs/protocol/` as the common directory for modules that implement or
describe communication protocols.

Move existing protocol modules into this directory. For example:

```text
fjs/mcp/ -> fjs/protocol/mcp/
```

Keep data formats and media types under `fjs/media/`; move only modules whose
primary responsibility is protocol behavior, messages, operations, or
transport-independent communication semantics.

The move should preserve module boundaries and behavior. Update imports,
documentation, TODO links, package metadata, generated files, and other path
references as required.

### Tasks

- [ ] Identify existing modules under `fjs/` whose primary responsibility is a protocol.
- [ ] Create `fjs/protocol/`.
- [ ] Move `fjs/mcp/` to `fjs/protocol/mcp/`.
- [ ] Move any other identified protocol modules to corresponding subdirectories under `fjs/protocol/`.
- [ ] Update all imports and path references.
- [ ] Update documentation and TODO links that reference the old locations.
- [ ] Regenerate repository-generated files as required.
- [ ] Run the full TypeScript and FunctionalScript test suites.
