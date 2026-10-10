## Put Rust projects under nanvm/

**Priority:** P3
**Status:** open

### Problem

Rust projects live in separate top-level `nanvm-*` directories. Group them
under `nanvm/` to give the native code a shared home.

### Proposal

Move all Rust projects under `nanvm/`, preferring `nanvm/{something}` over
`nanvm/nanvm-{something}`:

- `nanvm-lib/` → `nanvm/lib/`
- `nanvm-harness/` → `nanvm/harness/`
- `nanvm-effects-node/` → `nanvm/effects-node/`

This is a directory reorganization; Cargo package names remain unchanged.

### Tasks

- [ ] Move all Rust project directories under `nanvm/` using the preferred
      names, including their tests, fixtures, documentation, and local TODOs.
- [ ] Update Cargo workspace members and dependency paths.
- [ ] Update generators, scripts, CI configuration sources, and documentation
      links that refer to the old paths; regenerate affected outputs.
- [ ] Verify the workspace builds and tests pass, including the native harness
      and Node-effects integration.
