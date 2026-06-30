## cas-get-response-overflow. `cas_get content:true` can still crash on a `maxLengthBytes` blob

**Priority:** P2
**Status:** open
**Blocked by:** —

### Problem

`cas_get`'s `content: true` guard in `fs/cas/mcp/module.f.ts` only checks the
*raw* blob length against `maxLengthBytes`:

```ts
if (length > maxLengthBytes) {
    return pure(errorResult(
        `blob too large to fetch inline (${length} bytes, limit ${maxLengthBytes} bytes); ...`))
}
```

A blob at exactly `maxLengthBytes` passes this guard, but the **serialized
response** can still exceed `maxLength`:

- `type: 'base64'` inflates the raw bytes by ≈ 4/3 (RFC 4648), and the JSON
  envelope (`{"length":...,"mime_type":...,"type":"base64","content":"..."}`)
  adds more on top.
- The transport then encodes the *whole response line* as one `Vec`:
  `fs/mcp/stdio/module.f.ts` `writeResponse` calls
  `utf8(stringifyJson(resp) + '\n')`, using the **total** `utf8` (the
  `mapUnwrap` wrapper around `tryUtf8`). When the encoded line exceeds
  `maxLength`, `utf8` throws instead of returning `null`.

So a `maxLengthBytes` binary blob fetched with `content: true` can make
`writeResponse` throw — an unhandled throw inside the MCP server, which
crashes the process (most easily reproduced on `bun`, whose `bigint` ceiling
is lower than V8's). This is a user-facing crash path, not just a missing
error message: the existing `length > maxLengthBytes` guard gives a false
sense of safety because it checks the wrong quantity.

### Proposal

Two complementary fixes:

1. **Tighten the `cas_get` guard** to account for the response encoding, not
   just the raw blob length. For `type: 'base64'`, the inline string is
   `ceil(length / 3) * 4` bytes; add the (cheap, fixed-shape) JSON envelope
   overhead and compare *that* total against `maxLength`/`maxLengthBytes`,
   so a blob whose serialized form would overflow is rejected by the existing
   `errorResult` path instead of reaching `writeResponse`.
2. **Make the transport non-throwing.** `fs/mcp/stdio/module.f.ts`
   `writeResponse` should use `tryUtf8` instead of the total `utf8`, and
   handle `null` by writing a fallback error response (or a minimal
   `-32603`-style internal-error line) instead of letting the throw escape.
   This is the durable fix: it protects every MCP response, not just
   `cas_get`'s, against any oversized payload a handler might produce.

(1) is the targeted, `cas_get`-specific fix; (2) is the general safety net per
the `cas-add-inline-size-error` precedent of never letting `utf8`/`decode`
throw across an MCP boundary. Both narrow the same class of bug `cas_add`'s
inline-size handling already addresses on the input side; this is the
output-side counterpart.

### Tasks

- [ ] `fs/cas/mcp/module.f.ts` `cas_get`: replace the raw `length >
      maxLengthBytes` check (the `content: true` branch) with a check against
      the serialized response size for the chosen `type` (base64 inflation +
      JSON envelope for `base64`; UTF-8 bytes + envelope for `text`).
- [ ] `fs/mcp/stdio/module.f.ts` `writeResponse`: switch from `utf8` to
      `tryUtf8`; on `null`, write a typed fallback error response instead of
      throwing.
- [ ] Proof tests: `fs/cas/mcp/proof.f.ts` — a binary blob at exactly
      `maxLengthBytes` requested with `content: true` returns a clean
      `isError` (not a crash) once its base64 + envelope would overflow;
      confirm the boundary where it still succeeds.

### Related

- `fs/cas/mcp/todo/cas-add-inline-size-error.md` — the input-side counterpart
  (`cas_add` must not let `utf8`/`decode` throw); this issue is the
  output-side gap on `cas_get`.
- `fs/cas/mcp/module.f.ts` — `cas_get` `content: true` handler and its
  `length > maxLengthBytes` guard.
- `fs/mcp/stdio/module.f.ts` — `writeResponse`, which encodes every MCP
  response via the total `utf8`.
- `fs/text/module.f.ts` — `tryUtf8` (non-throwing) vs total `utf8`.
