## Remote MCP Server URLs

**Priority:** P3
**Status:** open

### Problem

The CAS MCP server serves only over stdio, and `cas_get`'s `uri` is the
opaque `cas:<hash>`: it discloses nothing about the server, which never emits
a path of its own ([the emit-side invariant](../README.md#design-invariant-the-server-never-emits-a-server-path)),
but no client can fetch a blob by it either, and a blob too large for inline
content is reachable only through the `cas get` CLI.

A remote URL server should be provided with a URL translation function instead
of returning a URL from `FileCas`. It also means that an MCP HTTP server should

1. know its domain name,
2. provide read-only access to the URLs,
3. serve the URLs as resources.

### Proposal

Serving a blob as an MCP resource reuses what `cas_get` already answers. Its
response mirrors the resource-contents shape — `uri`, `mimeType`, `text` or
`blob`, plus `type` and `length` as extra fields — so that the tool view and the
resource view of one blob share a vocabulary (the rationale is in
[`../README.md`](../README.md)'s `cas_get` section). A `resources/read` must
therefore derive `{ uri, mimeType, text | blob }` exactly as `cas_get` does,
sharing its detector path, and its `uri` must be the one under which the same
blob is readable through `resources/read`, so a client moves from the tool
result to the resource without translation.

Where the server knows a blob's dialect, a `dialect` field may accompany
`mimeType` — e.g. `mimeType: "text/javascript"` with
`dialect: "vnd.fjs.datajs+vnd.fjs.fjs"` — and an HTTP response can carry the
same value as a `Dialect` header; the naming rule is in
[`fjs/media/README.md`](../../media/README.md#dialects).

### Tasks

- [ ] A URL translation function supplied to the server, serving a
      `cas:<hash>` under the server's own domain — never a store path.
- [ ] When resources land: serve blobs via `resources/read` with the identical
      `{ uri, mimeType, text | blob }` derivation, sharing the detector path
      with `cas_get`.

### Related

- [`../README.md`](../README.md#design-invariant-the-server-never-emits-a-server-path)
  — the emit-side invariant a URL translation must keep.
- [MCP roadmap](../../protocol/mcp/todo/roadmap.md) — the resource schemas
  `fjs/protocol/mcp` does not serve yet.
- [fjs/media/revision/README.md](../../media/revision/README.md) — the
  `dialect` tag inside revision blobs whose derived media type
  (`application/{dialect}+json`) the server can surface (after validation) as
  the response `mimeType`.
