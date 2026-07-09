## `cas_get` should satisfy the MCP resource response shape

**Priority:** P3
**Status:** open

### Problem

We plan to expose CAS objects as MCP resources (see [remote-url.md](remote-url.md),
point 3). An MCP `resources/read` result carries contents with the protocol-defined
fields `uri`, `mimeType`, and `text` or `blob` — those names are fixed by the MCP
schema and cannot be changed on our side.

Today the `cas_get` tool returns a custom JSON payload
`{ length, mime_type, type[, url][, content] }`. The same server would describe the
same blob with two vocabularies: `mime_type` in the tool response versus `mimeType`
in the resource response, `url` versus `uri`, `content` + `type: 'text' | 'base64'`
versus `text` / `blob`. `content` is also a poor key to keep: in MCP it already
names the tool-result envelope (`CallToolResult.content`), so a `content` field
*inside* our JSON payload collides with the protocol term for the thing that
carries the payload.

### Proposal

Align the `cas_get` response with the MCP resource contents shape, so the tool view
and the (future) resource view of a blob use the same terminology:

- `mime_type` → `mimeType` — same key as MCP resource contents.
- Inline content (`content: true` requests): `type: 'text'` + `content` → `text`;
  `type: 'base64'` + `content` → `blob`.
- Metadata-only (default) responses carry no `text`/`blob`, so the `type`
  discriminator **stays** there: `{ length, mimeType, type[, uri] }`. Dropping it
  would leave clients no signal for whether a later fetch yields text or base64.
  (MCP allows extra fields, so `type` and `length` may simply always be present;
  the resource-contents shape is only fully satisfied when content is included.)
- `url` → `uri` — and its value should be the resource URI under which the same
  blob is (or will be) readable via `resources/read`, so a client can move from
  the tool result to the resource without translation.
- `length` stays — MCP allows additional fields alongside the required ones.
- Future: an optional `dialect` field may accompany `mimeType` when the blob is a
  recognized FS dialect of a standard type — e.g. `mimeType: "text/javascript"` with
  `dialect: "vnd.fjs.djs"`. The wire type stays interoperable while the precise
  format is still reported; HTTP responses can carry the same value as a `Dialect`
  header. See the dialect naming rule in
  [../../../todo/group-fs-subdirectories-by-concern.md](../../../todo/group-fs-subdirectories-by-concern.md).

### Tasks

- [x] Rename `mime_type` to `mimeType` in `Meta`, the `cas_get` handler, the tool
      description string, `proof.f.ts`, and `README.md`
- [x] Replace `type`/`content` with `text`/`blob` for inline-content responses,
      keeping `type` as the metadata-only discriminator
- [x] Rename `url` to `uri` and define its relation to the future resource URI
- [ ] When resources land: serve blobs via `resources/read` with the identical
      `{ uri, mimeType, text | blob }` derivation, sharing the detector path with
      `cas_get`

### Related

- [remote-url.md](remote-url.md) — serving URLs as resources
- [../../todo/revision-content-format.md](../../todo/revision-content-format.md) —
  the `dialect` format tag inside revision blobs whose derived media type
  (`application/{dialect}+json`) the server can surface (after validation) as the
  response `mimeType`
