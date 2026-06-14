# 66F-cas-mcp-file-type. Include file type (MIME) in CAS MCP content

**Priority:** P2
**Status:** open
**Blocked by:** [i66E-cas-mcp-base64-content](./66E-cas-mcp-base64-content.md)

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

### 1. Accept `mimeType` in `cas_add`

Extend `casAddArgs` with an optional `mimeType` field:

```ts
export const casAddArgs = {
    content: string,       // base64-encoded bytes (after i66E-cas-mcp-base64-content lands)
    mimeType: option(string),
} as const
```

When `mimeType` is provided, store it alongside the content so it can be
returned by `cas_get`. The simplest storage strategy is a second KV entry
keyed by `<hash>:mime`, written in the same `cas_add` handler (no changes to
`Cas<O>` itself — use the underlying `KvStore` directly, or add a parallel
`CasMeta<O>` wrapper).

### 2. Return `mimeType` in `cas_get`

When a MIME type is stored for a hash, `cas_get` returns an
`EmbeddedResource` (`BlobResource`) content item instead of bare
`textContent`:

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

When no MIME type is known (content was stored without one), fall back to
the existing `textContent` response so the tool remains backward compatible.

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

- [ ] Add `blobResource` and `embeddedResource` schemas to
      `fs/mcp/module.f.ts`; update `toolsCallResult` content union
- [ ] Extend `casAddArgs` with `mimeType: option(string)` in
      `fs/cas/mcp/module.f.ts`
- [ ] On `cas_add`, when `mimeType` is present, persist it (e.g. a
      `<hash>:mime` entry in the underlying KV store)
- [ ] On `cas_get`, look up any stored MIME type and return
      `EmbeddedResource` when found, plain `textContent` otherwise
- [ ] Update `fs/cas/mcp/proof.f.ts`: add round-trip tests for typed
      content (`cas_add` with `mimeType` → `cas_get` returns `EmbeddedResource`)
      and for untyped content (backward-compat path)
- [ ] Update `fs/cas/mcp/README.md` to document the `mimeType` field and
      the two result shapes

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
