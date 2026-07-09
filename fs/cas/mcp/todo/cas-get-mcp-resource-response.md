# `cas_get` should satisfy the MCP resource response shape

- **Status:** open

## Problem

We plan to expose CAS objects as MCP resources (see [remote-url.md](remote-url.md),
point 3). An MCP `resources/read` result carries contents with the protocol-defined
fields `uri`, `mimeType`, and `text` or `blob` — those names are fixed by the MCP
schema and cannot be changed on our side.

Today the `cas_get` tool returns a custom JSON payload
`{ length, mime_type, type[, url][, content] }`. The same server would describe the
same blob with two vocabularies: `mime_type` in the tool response versus `mimeType`
in the resource response, `url` versus `uri`, `content` + `type: 'text' | 'base64'`
versus `text` / `blob`.

## Proposal

Align the `cas_get` response with the MCP resource contents shape, so the tool view
and the (future) resource view of a blob use the same terminology:

- `mime_type` → `mimeType` — same key as MCP resource contents.
- `type: 'text'` + `content` → `text`; `type: 'base64'` + `content` → `blob` —
  the presence of `text` vs `blob` carries what `type` encodes today.
- `url` → `uri` — and its value should be the resource URI under which the same
  blob is (or will be) readable via `resources/read`, so a client can move from
  the tool result to the resource without translation.
- `length` stays — MCP allows additional fields alongside the required ones.

### Tasks

- [ ] Rename `mime_type` to `mimeType` in `Meta`, the `cas_get` handler, the tool
      description string, `proof.f.ts`, and `README.md`
- [ ] Replace `type`/`content` with `text`/`blob` per the mapping above
- [ ] Rename `url` to `uri` and define its relation to the future resource URI
- [ ] When resources land: serve blobs via `resources/read` with the identical
      `{ uri, mimeType, text | blob }` derivation, sharing the detector path with
      `cas_get`

## Related

- [remote-url.md](remote-url.md) — serving URLs as resources
- [../../todo/revision-content-format.md](../../todo/revision-content-format.md) —
  the `mimeType` format tag inside revision blobs that the server can surface (after
  validation) as the response `mimeType`
