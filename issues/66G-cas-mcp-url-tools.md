# 66G-cas-mcp-url-tools. `cas_add_url` / `cas_get_meta` — file-path alternatives to avoid token-heavy binary transfers

**Priority:** P3
**Status:** open

## Problem

`cas_add` and `cas_get` route binary content through the MCP text channel as
base64 strings. For large files this is doubly painful:

1. **Token cost.** A 1 MB file becomes ~1.4 MB of base64, which the model must
   read and write in a single tool call. Token limits and cost make this
   impractical for anything beyond small snippets.
2. **Capability gap.** Claude and other agents cannot directly read a file from
   disk and hand it to a tool call as raw bytes — the model can only pass text it
   has already ingested. So uploading a large local file via `cas_add` requires
   the model to have seen the full content first, which is circular.
3. **Decision ambiguity.** A client calling `cas_get` does not know the size or
   type of the content in advance, so it cannot decide whether inline retrieval
   is appropriate without fetching the content first.

## Proposal

Add two companion tools:

| Tool           | arg                     | behaviour                                                              |
|----------------|-------------------------|------------------------------------------------------------------------|
| `cas_add_url`  | `{ url: string }`       | Read the file at `url`, store it, return the hash                      |
| `cas_get_meta` | `{ hash: string }`      | Return `{ length, mime_type, url }` for the blob — no content transfer |

For a **local server** (the current `fjs cas mcp` stdio server):

- `cas_add_url`: `url` is a filesystem path (e.g. `/home/user/photo.jpg`). The
  server reads the file directly without the model touching the bytes.
- `cas_get_meta`: returns metadata about the blob — its byte length, inferred
  MIME type, and the filesystem path (`url`) to the blob inside `.cas/`. The
  client can then decide whether to call `cas_get` for inline content (small
  text items) or use the `url` directly (large or binary items), without
  fetching the content first.

Example `cas_get_meta` result:

```json
{
  "url": "/home/user/.cas/AB/CD/EFGH...",
  "mime_type": "image/jpeg",
  "length": 204800
}
```

### Client decision protocol

1. Call `cas_get_meta` to inspect `length` and `mime_type`.
2. If the content is small and text-based → call `cas_get` for inline content.
3. If the content is large or binary → use the `url` from meta directly, with no
   further tool call.

### MIME type handling

CAS stores only content — no metadata about blobs. `cas_get_meta` must therefore
infer `mime_type` at read time from the blob itself (magic-byte sniffing), the
same way a web server would serve an unknown file. The tool result includes
`mime_type` as a best-effort field; if the type cannot be determined,
`application/octet-stream` is the fallback.

## Tasks

- [ ] Design the `cas_add_url` / `cas_get_meta` argument rtti schemas.
- [ ] Implement `cas_add_url` in `fs/cas/mcp/module.f.ts`: read file at path,
      call `c.write`, return hash.
- [ ] Implement `cas_get_meta` in `fs/cas/mcp/module.f.ts`: call `c.read`,
      return `{ url, mime_type, length }` without transferring content.
- [ ] Add the two tools to `casMcpHandlers`.
- [ ] Extend `fs/cas/mcp/proof.f.ts` with round-trip tests for the new tools.

## Related

- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original CAS MCP design;
  `cas_add` / `cas_get` encoding decisions live there.
- [i66G-cas-mcp-cwd-home](./66G-cas-mcp-cwd-home.md) — CAS root must be a known
  path before `cas_get_meta` can return a meaningful blob URL.
- `fs/cas/mcp/module.f.ts` — `casMcpHandlers` to be extended with the new tools.
