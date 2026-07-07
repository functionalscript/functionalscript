## 66K-cas-cli-mcp-shared-core. Share code between CAS CLI and MCP

**Priority:** P3
**Status:** open

### Problem

The CAS CLI (`fs/cas/module.f.ts` `commands`) and the CAS MCP server
(`fs/cas/mcp/module.f.ts`) both implement the same three operations — add,
get, list — but with duplicated logic:

- Both construct `fileCas(sha256)(home)` independently.
- Both encode/decode hashes with `cBase32ToVec` / `vecToCBase32` in separate
  call sites.
- Content encoding policy (UTF-8 detection, base64, magic-byte sniffing)
  lives only in the MCP layer; the CLI (`add`, `get`) bypasses it
  and deals in raw bytes, so any future encoding rule must be maintained in
  two places.
- Error messages for invalid hashes and missing blobs are written twice.

If a new operation or encoding rule is added, both transports must be updated
separately, with no compile-time guarantee they stay in sync.

> **Scope note (see `remove-local-file-urls-mcp`, implemented — MCP `type:'url'` is gone):** the shared `add`
> design below originally included a `url` (file-path) source for *both*
> transports. That issue removes local-path upload from the MCP server — the
> server must never open a caller-supplied path. So the file-path source is a
> **CLI-only** concern here; the MCP adapter shares only the inline
> (`text`/`base64`) path and the hash/store/error plumbing. Do not reintroduce
> an MCP file-path branch while unifying.

### Proposal

Extract a transport-agnostic CAS operation layer — a small set of typed
functions that each accept a `Cas<O>` and return an `Effect` — shared by both
the CLI command handlers and the MCP tool handlers. This layer owns:

- building `fileCas(sha256)(home)` once (or accepting the `Cas<O>` as a
  parameter),
- hash parsing and error reporting,
- content encoding/decoding rules (text / base64 / mime detection).

The CLI and MCP modules become thin adapters: CLI maps flags/args to the
shared calls; MCP maps JSON-RPC tool args to the same calls.

#### `add` operation — unified design

The shared layer defines a single `add` input type. Inline content is shared by
both transports; the file-path source is **CLI-only** (per the scope note above,
the MCP server never opens a caller-supplied path):

| Source | CLI | MCP |
|--------|-----|-----|
| Inline content (bytes / text / base64 string) | `cas add <content>` | `cas_add { content, type? }` |
| File path | any path allowed | *not available* — MCP has no file-path source |

**Path handling** (CLI only) reuses the store's existing streaming write —
`fileCas.write` already stages under `~/.cas/_stage/` (random staging names,
lease-renewed, published to the hash-sharded path by `rename`) and `casAddFile`
already wraps `write(streamFile(path))` to stream any file in without buffering.
The CLI file-path `add` is therefore just `casAddFile(c)(path)` on a
user-supplied path — no new staging pipeline to build. Because this exists only
on the CLI — run by the user, bounded by their own filesystem permissions —
there is no sandbox-containment check to enforce; a plain path argument is
accepted as-is, the same as `cp`.

> **Architecture note (2026-07):** an earlier draft of this issue proposed a
> separate `./cas/stage/` read-only move pipeline and a new
> `KvStore.move(stagePath, key)` entry point. That is obsolete — there is no
> `KvStore`/`fileKvStore` abstraction any more (the store is `fileCas` returning
> a `Cas<O>`), and `fileCas.write` already performs the streaming staged move
> under `.cas/_stage`. Reuse that write path; do **not** build a parallel
> staging design.

### Tasks

- [ ] Identify all logic duplicated between `commands` (CLI) and
      `casToolRegistry` (MCP) — hash codec, store construction, encoding rules.
- [ ] For the CLI file-path `add`, reuse `casAddFile` / `fileCas.write` (already
      streams and stages under `.cas/_stage`) — no new `KvStore.move` or
      `./cas/stage/` pipeline (both obsolete; see architecture note above).
- [ ] Define a shared `casOps` (or similar) module/functions in
      `fs/cas/ops/module.f.ts` (or inline in `fs/cas/module.f.ts`) that
      expose typed operations independent of transport. The inline
      (`text`/`base64`) `add` and the hash/store/error plumbing are shared; the
      file-path `add` is a CLI-only entry point, not part of the MCP surface.
- [ ] Refactor CLI `commands` to delegate to the shared layer (inline + the
      CLI-only file-path `add`).
- [ ] Refactor `casToolRegistry` to delegate to the shared layer (inline only —
      no file-path source; MCP `type:'url'` has already been removed).
- [ ] Verify no behaviour change: existing CLI and MCP tests still pass; add
      new tests for the CLI staging flow.

### Related

- `remove-local-file-urls-mcp` (implemented, todo file deleted) — removed the
  MCP file-path (`url`) source; this issue's shared `add` must keep the
  file-path source CLI-only
- `fs/cas/module.f.ts` — CLI commands and core types
- `fs/cas/mcp/module.f.ts` — MCP tool registry and server
