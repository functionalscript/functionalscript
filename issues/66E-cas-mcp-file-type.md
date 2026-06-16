# 66E-cas-mcp-file-type. Include file type (MIME) in CAS MCP content

**Priority:** P2
**Status:** done

## Problem

`cas_get` returns file content as an opaque `textContent` block with no type
metadata:

```json
{ "type": "text", "text": "<cBase32-encoded bytes>" }
```

A client that stored a PNG, a PDF, or a JSON document cannot tell from the
`tools/call` result what kind of content it received. Downstream consumers —
an LLM, a browser, another tool — have to guess or content-sniff. The CAS
store is type-agnostic by design, but the MCP adapter is the right place to
surface type information when it is known.

`cas_add` has the symmetric gap: there is no way to attach a MIME type when
storing, so the store cannot associate one with the hash.

## How other MCP services handle file type

The MCP spec defines three content item types used in `tools/call` results
and embedded resources, all of which carry explicit type metadata:

| Content type       | Key fields                                     | `mimeType` |
|--------------------|------------------------------------------------|------------|
| `TextContent`      | `{ type: "text", text }`                       | none       |
| `ImageContent`     | `{ type: "image", data, mimeType }`            | required   |
| `AudioContent`     | `{ type: "audio", data, mimeType }`            | required   |
| `EmbeddedResource` | `{ type: "resource", resource: TextResource \| BlobResource }` | optional |

`TextResource` and `BlobResource` (the two shapes inside `EmbeddedResource`)
both carry an optional `mimeType` alongside `uri` and `text`/`blob`:

```json
{
  "type": "resource",
  "resource": {
    "uri": "cas://sha256/<hash>",
    "mimeType": "image/png",
    "blob": "<base64-encoded bytes>"
  }
}
```

`blob` is base64-encoded binary; `text` is plain UTF-8. Using
`EmbeddedResource` with `BlobResource` is how MCP-idiomatic servers expose
typed binary content — the `mimeType` travels with the bytes, and clients
(including LLMs) know how to render or route each type.

Currently `fs/mcp/module.f.ts` only models `textContent`. The `image`,
`audio`, and `resource` variants are acknowledged in
[i665-mcp](./665-mcp.md) but not yet implemented.

## Proposal

The CAS store is type-agnostic and stores raw bytes only — no metadata is
added on write. File type is **detected from the blob content** on read, using
magic-byte signatures, and included in the `cas_get` response. No changes to
`cas_add` or the underlying store.

### 1. Magic-byte MIME detector (`fs/mime/module.f.ts`)

A new pure module that maps the leading bytes of a `Vec` to a MIME type
string (or `null` when unrecognised):

```ts
export const detect = (bytes: Vec): string | null => { … }
```

Coverage should include the common formats: PNG, JPEG, GIF, WebP, PDF, ZIP,
and UTF-8 text (fallback for printable-ASCII content). The function is a
pure table lookup over the first N bytes — no I/O, no dependencies beyond
`fs/vec`.

### 2. Return detected `mimeType` in `cas_get`

After reading the blob, call `detect(value)`. When a MIME type is
recognised, return an `EmbeddedResource` (`BlobResource`) content item:

```json
{
  "type": "resource",
  "resource": {
    "uri": "cas://sha256/<hash>",
    "mimeType": "image/png",
    "blob": "<base64-encoded bytes>"
  }
}
```

When `detect` returns `null` (unrecognised bytes), fall back to the existing
`textContent` response so the tool remains backward compatible.

### 3. Extend `fs/mcp/module.f.ts`

Add `blobResource` and `embeddedResource` content item schemas parallel to
`textContent`:

```ts
export const blobResource = {
    uri: string,
    mimeType: option(string),
    blob: string,          // base64
} as const

export const embeddedResource = {
    type: 'resource',
    resource: blobResource,   // or union with textResource once needed
} as const
```

Update `toolsCallResult.content` to accept a union of `textContent |
embeddedResource` (and `imageContent` / `audioContent` when those land).

## Tasks

- [x] Add `fs/mime/module.f.ts`: `detect(bytes: Vec): Nullable<string>` with
      magic-byte table for common formats; `fs/mime/proof.f.ts` with fixture
      tests per recognised type and the `null` fallback
- [x] Add `blobResource` and `embeddedResource` schemas to
      `fs/mcp/module.f.ts`; update `toolsCallResult` content union
      (`contentItem = or(textContent, embeddedResource)`)
- [x] In `fs/cas/mcp/module.f.ts`, call `detect` on the retrieved bytes in
      `cas_get`; return `embeddedResource` when MIME is detected, plain
      `textContent` otherwise
- [x] Update `fs/cas/mcp/proof.f.ts`: add tests for blobs with recognised
      magic bytes (get → `EmbeddedResource`) and for opaque bytes (get →
      `textContent`)
- [x] Update `fs/cas/mcp/README.md` to document MIME detection and the two
      result shapes; add `fs/mime/README.md`

## Resolution notes

Scope followed the roadmap (Layer 3): magic-byte detection only (PNG, JPEG,
GIF, WebP, PDF, ZIP) with `null` for everything else. The UTF-8 text fallback
floated in the original proposal was **dropped** — distinguishing UTF-8 from
arbitrary bytes is not a magic-byte test, and the caller's `null` branch
already routes unrecognised bytes to the plain `textContent` result. The
rationale lives in `fs/mime/README.md`. WebP is the one non-contiguous
signature (`RIFF`…`WEBP` with a 4-byte size in between), handled as a prefix
plus a marker at offset 8.

## Related

- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original CAS MCP design;
  file type was out of scope
- [i66E-cas-mcp-base64-content](./66E-cas-mcp-base64-content.md) — switches
  content encoding to base64, a prerequisite for `blob` fields
- [i665-mcp](./665-mcp.md) — roadmap; lists `image`, `audio`, `resource`
  content types as future work
- `fs/mcp/module.f.ts:70` — current `textContent` schema (`{ type, text }`)
- `fs/cas/mcp/module.f.ts:76` — `casGetTool` and `okResult` to be extended
- [MCP spec — Content types](https://spec.modelcontextprotocol.io/specification/basic/utilities/types/#content-types)
