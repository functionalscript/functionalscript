# Content-addressable storage (CAS)

A `hash → bytes` store: content is addressed by its SHA-256 hash, encoded as
a cbase32 string (see [`fs/basen/cbase32`](../basen/cbase32/)). The store is
type-agnostic — it keeps raw bytes only, with no per-blob type tag; type is
recovered on read by content-sniffing (see
[`fs/media/type`](../media/type/)), not written on add.

- [`fs/cas/cli`](cli/) — CLI commands for adding/reading blobs from a local
  file-backed CAS.
- [`fs/cas/mcp`](mcp/) — an MCP server exposing the CAS as tools (`cas_add`,
  `cas_get`, `cas_list`) for MCP clients.

## Content formats

CAS blobs are immutable, so anything built on top of a *mutable* object —
"the same document, but updated" — needs its own convention for linking a
chain (or DAG) of versions together. [`fs/media/revision`](../media/revision/)
defines the `vnd.fjs.revision` format for this: a BLOB representing one step
in the evolution of a mutable object, referencing its parent revision(s) and
carrying the full materialized content. `fs/media/type` detects revision
blobs and reports them as `application/vnd.fjs.revision+json`; store-touching
evolution operations (head resolution, materialization) are a separate,
not-yet-built layer — see the format's README for the current scope.
