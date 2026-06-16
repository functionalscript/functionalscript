# 66G-cas-mcp-text-content. Smart text/binary encoding for `cas_add` / `cas_get`

**Priority:** P3
**Status:** open

## Problem

`cas_add` accepts only base64-encoded content, and `cas_get` always returns
base64. This is unnecessarily hostile for text content: storing a JSON file,
a script, or a prompt requires the model to base64-encode it before calling
`cas_add`, and to decode the result of `cas_get` before reading it. Both steps
waste tokens and make the tools awkward to use for the common case.

## Proposal

### `cas_add`: accept string or base64

Extend the `cas_add` argument schema with a `type` discriminator:

```ts
const casAddArgs = { content: string, type: optional('text' | 'base64') } as const
```

- `type: 'text'` (or omitted, defaulting to `'text'`): `content` is a UTF-8
  string; the server encodes it to bytes directly.
- `type: 'base64'`: existing behaviour — `content` is RFC 4648 base64.

Defaulting to `'text'` is the right choice because most agent-generated content
is textual, and it avoids a breaking change for callers that already pass plain
strings without a type field.

### `cas_get`: return string or base64, driven by inferred MIME type

After reading the blob, infer the MIME type from the content (magic-byte
sniffing; see [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md)). If the
inferred type is text (e.g. `text/*`, `application/json`, `application/xml`),
return the content as a UTF-8 string. Otherwise return it as base64. Include
`type` in the result so the caller knows which encoding was used:

```json
{ "content": "hello world\n", "type": "text", "mime_type": "text/plain" }
{ "content": "iVBOR...",       "type": "base64", "mime_type": "image/png" }
```

The result is always a single JSON object encoded in the `text` block (or a
structured content block if the MCP client supports it).

### Consistency with `cas_get_url`

`cas_get_url` (see [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md)) returns
a path rather than inline content, so its `mime_type` field uses the same
inference logic but does not need the `type` / encoding field.

## Tasks

- [ ] Extend `casAddArgs` in `fs/cas/mcp/module.f.ts` with an optional `type`
      field; update the `cas_add` handler to branch on `'text'` vs `'base64'`.
- [ ] Implement MIME-type inference (magic bytes) for `cas_get`; determine
      whether the result is text or binary.
- [ ] Update the `cas_get` handler to return a structured result object with
      `content`, `type`, and `mime_type` fields.
- [ ] Update `fs/cas/mcp/proof.f.ts`: add round-trip tests for text add→get and
      binary add→get; verify the `type` field in each result.
- [ ] Update `fs/cas/mcp/README.md` to document the new encoding behaviour.

## Related

- [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md) — `cas_get_url` shares
  the MIME-type inference logic introduced here.
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original encoding decision
  (base64 for content); this issue supersedes that choice for text content.
- `fs/cas/mcp/module.f.ts` — `casAddArgs`, `casMcpHandlers` to be updated.
