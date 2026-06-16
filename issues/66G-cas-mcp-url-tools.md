# 66G-cas-mcp-url-tools. `cas_add_url` / `cas_get_url` — file-path alternatives to avoid token-heavy binary transfers

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

## Proposal

Add two companion tools that use file paths instead of inline content:

| Tool           | arg                     | behaviour                                             |
|----------------|-------------------------|-------------------------------------------------------|
| `cas_add_url`  | `{ url: string }`       | Read the file at `url`, store it, return the hash     |
| `cas_get_url`  | `{ hash: string }`      | Look up the hash, return the path to the blob in CAS, plus `mime_type` |

For a **local server** (the current `fjs cas mcp` stdio server):

- `cas_add_url`: `url` is a filesystem path (e.g. `/home/user/photo.jpg`). The
  server reads the file directly without the model touching the bytes.
- `cas_get_url`: returns the path to the blob file inside `.cas/` (the sharded
  path produced by `toPath`), so the user or another tool can consume it without
  another round-trip through the model. Also returns a `mime_type` field inferred
  from the file extension or stored separately (see open questions below),
  mirroring the metadata pattern already established by `cas_get`.

Example `cas_get_url` result:

```json
{
  "path": "/home/user/.cas/AB/CD/EFGH...",
  "mime_type": "image/jpeg"
}
```

### MIME type handling

CAS stores only content — no metadata about blobs. `cas_get_url` must therefore
infer `mime_type` at read time from the blob itself (magic-byte sniffing), the
same way a web server would serve an unknown file. The tool result includes
`mime_type` as a best-effort field; if the type cannot be determined,
`application/octet-stream` is the fallback.

## Tasks

- [ ] Design the `cas_add_url` / `cas_get_url` argument rtti schemas.
- [ ] Implement `cas_add_url` in `fs/cas/mcp/module.f.ts`: read file at path,
      call `c.write`, return hash.
- [ ] Implement `cas_get_url` in `fs/cas/mcp/module.f.ts`: call `c.read`, write
      to a temporary location or return the existing blob path, return path +
      `mime_type`.
- [ ] Add the two tools to `casMcpHandlers`.
- [ ] Extend `fs/cas/mcp/proof.f.ts` with round-trip tests for the new tools.

## Related

- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original CAS MCP design;
  `cas_add` / `cas_get` encoding decisions live there.
- [i66G-cas-mcp-cwd-home](./66G-cas-mcp-cwd-home.md) — CAS root must be a known
  path before `cas_get_url` can return a meaningful blob path.
- `fs/cas/mcp/module.f.ts` — `casMcpHandlers` to be extended with the new tools.
