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

## Tasks

- [ ] Identify all logic duplicated between `commands` (CLI) and
      `casToolRegistry` (MCP) — hash codec, store construction, encoding rules.
- [ ] Define a shared `casOps` (or similar) module/functions in
      `fs/cas/ops/module.f.ts` (or inline in `fs/cas/module.f.ts`) that
      expose typed operations independent of transport.
- [ ] Refactor CLI `commands` to delegate to the shared layer.
- [ ] Refactor `casToolRegistry` to delegate to the shared layer.
- [ ] Verify no behaviour change: existing CLI and MCP tests still pass.

## Related

- `fs/cas/module.f.ts` — CLI commands and core types
- `fs/cas/mcp/module.f.ts` — MCP tool registry and server
