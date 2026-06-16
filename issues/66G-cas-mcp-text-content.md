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

After reading the blob, infer the MIME type using the two-phase algorithm below.
If the inferred type is text, return the content as a UTF-8 string; otherwise
return it as base64. Include `type` in the result so the caller knows which
encoding was used:

```json
{ "content": "hello world\n", "type": "text", "mime_type": "text/plain" }
{ "content": "iVBOR...",       "type": "base64", "mime_type": "image/png" }
```

The result is always a single JSON object encoded in the `text` block (or a
structured content block if the MCP client supports it).

### MIME inference algorithm

Detection runs in two phases:

1. **Binary magic-byte sniffing** (`fs/mime` `detect`): checks the leading
   bytes against known signatures (PNG, JPEG, GIF, WebP, PDF, ZIP). If a
   signature matches, that MIME type is used and phase 2 is skipped.

2. **UTF-8 validation** (`fs/text/utf8`): attempt to decode the entire blob as
   UTF-8. If decoding succeeds (no error code points), classify as `text/plain`.
   If any invalid byte sequence is found, fall back to `application/octet-stream`.

This replaces heuristics (null-byte scanning) with a strict correctness check:
a blob is text if and only if it is valid UTF-8. No other text encodings (UTF-16,
Latin-1, etc.) are considered.

### Required addition to `fs/text/utf8`

`fs/text/utf8` currently works with `List<U8>` streams. A new export is needed:

```ts
/** Returns the decoded string if `v` is valid UTF-8, or `null` otherwise. */
export const fromVec: (v: Vec) => string | null
```

The implementation should use the platform `TextDecoder` with `fatal: true`,
which throws on any invalid UTF-8 byte sequence — including overlong encodings,
surrogate halves, and out-of-range code points that the existing `toCodePointList`
decoder does not mark with `errorMask`. `fromVec` converts the `Vec` to a
`Uint8Array`, passes it to `new TextDecoder('utf-8', { fatal: true }).decode()`,
and returns the resulting string on success or `null` if it throws.

`cas_get` and `cas_get_meta` both call `fromVec` to determine whether the blob
is text.

### Consistency with `cas_get_meta`

`cas_get_meta` (see [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md)) returns
metadata rather than inline content, so its `mime_type` field uses the same
inference logic but does not need the `type` / encoding field.

## Tasks

- [ ] Add `fromVec: (v: Vec) => string | null` to `fs/text/utf8/module.f.ts`:
      convert `Vec` to `Uint8Array`, decode with
      `new TextDecoder('utf-8', { fatal: true })`, return the string or `null`
      on failure. This correctly rejects overlongs, surrogates, and out-of-range
      code points that the streaming decoder does not flag with `errorMask`.
- [ ] Add proof cases to `fs/text/utf8/proof.f.ts` for `fromVec`: valid ASCII,
      valid multi-byte UTF-8, and invalid byte sequences each returning `null`.
- [ ] Extend `casAddArgs` in `fs/cas/mcp/module.f.ts` with an optional `type`
      field; update the `cas_add` handler to branch on `'text'` vs `'base64'`.
- [ ] Update the `cas_get` handler: run `fs/mime` `detect` first (phase 1),
      then `fromVec` (phase 2); return structured `{ content, type, mime_type }`.
- [ ] Update `fs/cas/mcp/proof.f.ts`: add round-trip tests for text add→get and
      binary add→get; verify the `type` field in each result.
- [ ] Update `fs/cas/mcp/README.md` to document the new encoding behaviour.

## Related

- [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md) — `cas_get_url` shares
  the MIME-type inference logic introduced here.
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original encoding decision
  (base64 for content); this issue supersedes that choice for text content.
- `fs/cas/mcp/module.f.ts` — `casAddArgs`, `casMcpHandlers` to be updated.
