# 66K-cas-cli-mcp-shared-core. Share code between CAS CLI and MCP

**Priority:** P3
**Status:** open

## Problem

The CAS CLI (`fs/cas/module.f.ts` `commands`) and the CAS MCP server
(`fs/cas/mcp/module.f.ts`) both implement the same three operations — add,
get, list — but with duplicated logic:

- Both construct `cas(sha256)(fileKvStore(home))` independently.
- Both encode/decode hashes with `cBase32ToVec` / `vecToCBase32` in separate
  call sites.
- Content encoding policy (UTF-8 detection, base64, magic-byte sniffing,
  `url` type) lives only in the MCP layer; the CLI (`add`, `get`) bypasses it
  and deals in raw bytes, so any future encoding rule must be maintained in
  two places.
- Error messages for invalid hashes and missing blobs are written twice.

If a new operation or encoding rule is added, both transports must be updated
separately, with no compile-time guarantee they stay in sync.

## Proposal

Extract a transport-agnostic CAS operation layer — a small set of typed
functions that each accept a `Cas<O>` and return an `Effect` — shared by both
the CLI command handlers and the MCP tool handlers. This layer owns:

- building `cas(sha256)(fileKvStore(home))` once (or accepting it as a
  parameter),
- hash parsing and error reporting,
- content encoding/decoding rules (text / base64 / url / mime detection).

The CLI and MCP modules become thin adapters: CLI maps flags/args to the
shared calls; MCP maps JSON-RPC tool args to the same calls.

### `add` operation — unified design

The shared layer defines a single `add` input type with two mutually exclusive
sources:

| Source | CLI | MCP |
|--------|-----|-----|
| Inline content (bytes / text / base64 string) | `cas add <content>` | `cas_add { content, type? }` |
| File path (`url`) | any path allowed | only paths inside `~/cas_upload/` |

**Path handling** uses a staging area (`./cas/stage/`) to avoid partial writes
and to mark blobs read-only before they enter the store:

1. **Path inside `~/cas_upload/`** (both CLI and MCP):
   - Move the file into `./cas/stage/`.
   - Mark the staged file read-only.
   - Compute hash; move the file to its final CAS location.

2. **Path outside `~/cas_upload/`**:
   - **CLI**: Copy the file into `./cas/stage/` while computing the hash; mark
     it read-only; move it to its final CAS location.
   - **MCP**: Return `isError: true` with message `"access denied"` — the MCP
     server does not have filesystem access beyond the upload directory.

The staging step is the same in both cases; only the initial acquire differs
(move vs copy) and MCP enforces the path restriction before staging begins.

### `KvStore` interface change

The current `KvStore.write` accepts a `(key, value: Vec)` pair and writes the
bytes directly. To support the staging pipeline, `KvStore` needs a second entry
point:

```ts
move: (stagePath: string, key: Vec) => Effect<O, void>
```

`move` assumes the blob is already on disk at `stagePath` (inside
`./cas/stage/`), marked read-only, and simply renames it into its final CAS
location. This avoids re-reading large files into memory and keeps the
`write`-by-value path for inline content.

## Tasks

- [ ] Identify all logic duplicated between `commands` (CLI) and
      `casToolRegistry` (MCP) — hash codec, store construction, encoding rules.
- [ ] Add `move: (stagePath: string, key: Vec) => Effect<O, void>` to `KvStore`
      and implement it in `fileKvStore`.
- [ ] Design the staging directory (`./cas/stage/`) and the acquire-stage-store
      pipeline; add `Rename` / `Copy` effects if missing from
      `fs/effects/node/module.f.ts`.
- [ ] Define a shared `casOps` (or similar) module/functions in
      `fs/cas/ops/module.f.ts` (or inline in `fs/cas/module.f.ts`) that
      expose typed operations independent of transport, including the unified
      `add` with path-restriction parameter.
- [ ] Refactor CLI `commands` to delegate to the shared layer (pass
      `allowAnyPath: true`).
- [ ] Refactor `casToolRegistry` to delegate to the shared layer (pass
      `allowAnyPath: false`, returning `"access denied"` for out-of-sandbox
      paths).
- [ ] Verify no behaviour change: existing CLI and MCP tests still pass; add
      new tests for the staging flow and the MCP path-restriction error.

## Related

- `fs/cas/module.f.ts` — CLI commands and core types
- `fs/cas/mcp/module.f.ts` — MCP tool registry and server
