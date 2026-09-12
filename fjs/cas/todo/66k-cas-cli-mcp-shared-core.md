## 66K-cas-cli-mcp-shared-core. Share code between CAS CLI and MCP

**Priority:** P3
**Status:** blocked
**Blocked by:** [command-architecture](command-architecture.md)

> **Re-scoped (2026-07):** this issue is now the *implementation* follow-up
> of the CAS command architecture design
> ([command-architecture](command-architecture.md)). The design decides the
> command set, the typed input/output contracts, the error taxonomy, and the
> per-transport exposure matrix; the duplication inventory and the unified
> `add` notes below feed into that design and are then implemented against
> it, not independently.

### Problem

The CAS CLI (`fjs/cas/module.f.mjs` `commands`) and the CAS MCP server
(`fjs/mcp/cas/module.f.mjs`) both implement the same three operations — add,
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

**`cas_get`'s inspection policy is the largest single item of that
inventory.** The Evo tool entries (`fjs/mcp/evo/module.f.mjs`) and
`cas_list` are each a name, a description, a schema and one line of
dispatch — the shape a registry entry should have. The two CAS write/read
tools are not: `cas_add` (`fjs/mcp/cas/module.f.mjs:201-219`) decodes its
input, writes the blob, maps the write error, and synchronizes the Evo
cache inline, and `cas_get` (`:227-301`) is ~75 lines holding the whole
blob-inspection policy — the streaming-vs-buffered decision, the
`maxLengthBytes` cap and its message, when a dialect refinement is worth a
second read, the `text`→`fromVec` / `base64`→`base64Encode` split — none of
it MCP-specific, and the module doc has grown 45 lines of classification
prose to match. Inside the handler, the "materialize then re-classify" step
is written twice, on the metadata path (`:249-259`) and the inline-content
path (`:269-281`):

```js
return resultStep(
    collectRead(c.read(key)),
    ([collectTag, value]) => {
        if (collectTag === 'error') { … }        // the one real difference:
        const refined = detectDialect(value)     // fallback vs error
        …
```

and `no such hash` is spelled at `:238` and `:273`. The shared layer's
`get` is where that policy goes, as one typed inspection returning
`{ length, mimeType, type }` plus optional `text`/`blob` and a tagged error
(`absent` / `tooLarge(length)`), with the re-read step one private helper
and the caller deciding whether a failed second read is a fallback or an
error. **The `uri` field is not part of that record**: what `uri` is for is
the open decision in
[`fjs/mcp/todo/cas-get-uri-discloses-host-path.md`](../../mcp/todo/cas-get-uri-discloses-host-path.md),
and the MCP adapter shapes it (or omits it) per that decision, so the
shared layer neither settles nor forecloses it.

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
      `fjs/cas/ops/module.f.mjs` (or inline in `fjs/cas/module.f.mjs`) that
      expose typed operations independent of transport. The inline
      (`text`/`base64`) `add` and the hash/store/error plumbing are shared; the
      file-path `add` is a CLI-only entry point, not part of the MCP surface.
- [ ] Refactor CLI `commands` to delegate to the shared layer (inline + the
      CLI-only file-path `add`).
- [ ] Refactor `casToolRegistry` to delegate to the shared layer (inline only —
      no file-path source; MCP `type:'url'` has already been removed).
      `cas_get` collapses to registry shape — a `toolResultStep` over the
      shared inspection, wording unchanged, `uri` shaped by the adapter.
      `cas_add` collapses onto **two** shared functions, not one, so
      that the adapter keeps both values the Evo sync needs in scope:
      a pure `decodeInline: (input: { type?, content }) => Result<Vec, string>`
      (the `text`/`base64` decoding and the size cap, today's `x`), and
      an effectful `writeBlob: (c: Cas<O>) => (value: Vec) => Effect<…, Result<Vec, WriteError>, …>`
      (today's `c.write(nonEmpty(x, …))` plus the error mapping). The
      `syncRevision(cacheKey)(hash)(value)` step that keeps
      `evo_list`/`evo_head` current is an MCP-server concern (the CLI has
      no Evo cache), so it stays in `fjs/mcp/cas` as the adapter's own
      continuation, spelled against what `resultStep` actually passes —
      the `Result` tuple, not the hash:

      ```js
      const decoded = decodeInline(input)
      if (decoded[0] === 'error') { return pureOk(errorResult(decoded[1])) }
      const value = decoded[1]
      return resultStep(writeBlob(c)(value), r =>
          r[0] === 'error'
              ? pureOk(errorResult('write'))
              : resultStep(syncRevision(cacheKey)(r[1])(value),
                  () => pureOk(okResult(vecToCBase32(r[1])))))
      ```

      `value` is bound by the adapter from the shared decode, `r[1]` is
      the hash from the shared write, and the shared layer takes no cache
      key and no post-write hook. The CLI composes the same two functions
      without the sync.
- [ ] Verify no behaviour change: existing CLI and MCP tests still pass; add
      new tests for the CLI staging flow.

### Related

- `remove-local-file-urls-mcp` (implemented, todo file deleted) — removed the
  MCP file-path (`url`) source; this issue's shared `add` must keep the
  file-path source CLI-only
- `fjs/cas/module.f.mjs` — CLI commands and core types
- `fjs/mcp/cas/module.f.mjs` — MCP tool registry and server
- [`fjs/mcp/todo/cas-get-uri-discloses-host-path.md`](../../mcp/todo/cas-get-uri-discloses-host-path.md)
  — decides what `uri` is; the shared `get` leaves it to the adapter
- [`fjs/mcp/todo/cas-get-mcp-resource-response.md`](../../mcp/todo/cas-get-mcp-resource-response.md)
  — gets one place to re-shape once the inspection is a value
