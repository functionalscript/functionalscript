# 66K-cas-cli-mcp-shared-upload. CLI and MCP should share `cas_add`/`cas upload` logic

**Priority:** P3
**Status:** open

## Problem

The CLI (`fs/cas/module.f.ts`) and MCP server (`fs/cas/mcp/module.f.ts`) both
implement "store a file from `~/cas_upload/`" independently:

| Path | Implementation |
|------|---------------|
| `cas upload <name>` (CLI) | move-hash-move via `random256` + `streamHash` + `rename` — no size limit |
| `cas_add { type:'url' }` (MCP) | `readFile` — capped at 128 KiB |

As the upload pipeline gains correctness fixes (symlink rejection, read-only
chmod, cleanup policy), each fix must be applied in two places. The MCP path
currently lags: it can silently truncate or reject large files while the CLI
handles them correctly.

## Proposal

Extract the upload pipeline into a shared function in `fs/cas/module.f.ts` (or a
new `fs/cas/upload/module.f.ts`) that both the CLI handler and the MCP tool
delegate to:

```typescript
// proposed shared primitive
const casUpload = (home: string) => (fileName: string): Effect<..., Vec>
```

The function encapsulates `random256` → `mkdir` → `rename` to stage →
`streamHash` → `mkdir` → `rename` to final, and returns the hash. Both callers
then reduce to argument validation + calling `casUpload`.

The MCP `cas_add` with `type:'url'` should be replaced or supplemented by a
`cas_upload` tool that delegates to the same function, removing the 128 KiB cap
and ensuring the same security invariants apply regardless of transport.

## Tasks

- [ ] Export (or move) `random256` and `streamHash` from `fs/cas/module.f.ts` so
      they are reusable without re-implementing
- [ ] Extract a `casUpload(home)(fileName): Effect<..., Vec>` function shared by
      CLI and MCP
- [ ] Replace `cas_add { type:'url' }` in the MCP registry with a `cas_upload`
      tool (or upgrade the `type:'url'` branch) to use `casUpload` instead of
      `readFile`
- [ ] Ensure all future pipeline fixes (symlink rejection, chmod, cleanup) are
      applied once in `casUpload` and inherited by both transports

## Related

- [i66J-cas-streaming-upload-design](./66J-cas-streaming-upload-design.md) — streaming upload pipeline (CLI only so far)
- [i66K-cas-upload-reject-symlinks](./66K-cas-upload-reject-symlinks.md) — fix that must not be applied twice
- [i66K-cas-get-return-path](./66K-cas-get-return-path.md) — analogous read-path gap between CLI and MCP
