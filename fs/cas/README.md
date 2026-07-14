# CAS

Content-addressable storage: blobs on disk, addressed by content hash
([`fs/cas/module.f.ts`](module.f.ts)). The store is type-agnostic — it keeps
raw bytes only, sharded by cBase32 hash under `~/.cas/` — and never records a
mutable pointer or a per-blob type tag; both are recovered at the edges that
need them.

- [`fs/cas/mcp`](mcp/) — an MCP front end (`cas_add` / `cas_get` / `cas_list`)
  for agents, including read-time media-type detection.
- [`cas` CLI](cli/module.f.ts) — direct filesystem access for content larger
  than the MCP inline-content cap.

## Read-time integrity

The store never rehashes a blob on plain `read`/`cas get`/`cas_get`, so a blob
corrupted, truncated, or misnamed on disk (bit-rot, a copy-files sync that has
not yet been scrubbed) would otherwise be handed back silently. `verifyHash`
(`fs/cas/module.f.ts`) rehashes the streamed bytes and reports whether they
still match the requested address, without buffering the stream into memory.
It is opt-in — a full rehash costs a second read — via `cas get --verify` (CLI)
and `cas_get { verify: true }` (MCP); both fail with a distinct "hash mismatch"
error rather than the (corrupted) content. A separate batch
[`cas verify`](todo/66g-cas-verify-command.md) scans the whole store for the
same invariant.

## Content formats

Because the store is type-agnostic, a blob's format is recovered on read, not
declared on write. [`fs/media`](../media/) does that recovery: byte-signature
sniffing (PNG/JPEG/GIF/WebP/PDF/ZIP, `fs/media/type`) plus, for JSON blobs
that opt in, a self-describing `dialect` tag validated against an rtti
schema.

- [`vnd.fjs.revision`](../media/revision/) — one step in the evolution of a
  mutable object (a document, a config, any mutable state referenced by a
  stable name) on top of this immutable store: it links back to its parent
  revision(s) (a DAG, so concurrent edits can merge) and carries the full
  materialized content of that step. Served as
  `application/vnd.fjs.revision+json`; see
  [`fs/media/revision/README.md`](../media/revision/README.md) for the full
  spec and [the tracking issue](todo/revision-content-format.md) for scope
  and status.
