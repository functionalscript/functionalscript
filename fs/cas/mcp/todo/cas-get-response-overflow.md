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
response** can still exceed `maxLength`, for two compounding reasons:

- `type: 'base64'` inflates the raw bytes by ≈ 4/3 (RFC 4648), and the JSON
  envelope (`{"length":...,"mime_type":...,"type":"base64","content":"..."}`)
  adds more on top.
- **The response is JSON twice over.** `okResult(toJson({...meta, content}))`
  (`fs/cas/mcp/module.f.ts`) builds the CAS JSON *string* and puts it in
  `ToolsCallResult.content[0].text` — a `string` field. `mcpStep`
  (`fs/mcp/module.f.ts`) then wraps that `ToolsCallResult` as the JSON-RPC
  `result`, and `writeResponse` (`fs/mcp/stdio/module.f.ts`) serializes the
  *whole* `Response` with `stringifyJson`. So the inner CAS JSON string gets
  escaped **once** when `toJson` builds it, and **again** when the outer
  `stringifyJson` embeds it as `text`'s value. For `type: 'text'` content
  containing quotes, backslashes, or control characters, each such character
  can expand by the time both escaping passes are done — a literal quote
  expands 1 byte into 4, and a control byte such as NUL expands 1 byte into
  7 (a 6-character `\u00XX` escape on the inner pass, whose own backslash is
  re-escaped on the outer pass). A guard that sizes only the *inner* CAS
  JSON/raw content therefore still underestimates the final line for
  adversarial text and can let a payload through whose final line exceeds
  `maxLength`.
- The transport then encodes the *whole response line* as one `Vec`:
  `writeResponse` calls `utf8(stringifyJson(resp) + '\n')`, using the
  **total** `utf8` (the `mapUnwrap` wrapper around `tryUtf8`). When the
  encoded line exceeds `maxLength`, `utf8` throws instead of returning `null`.

So a `maxLengthBytes` blob fetched with `content: true` — binary (via base64
inflation) or, worse, text full of quote/backslash/control characters (via
double JSON escaping) — can make `writeResponse` throw: an unhandled throw
inside the MCP server, which crashes the process (most easily reproduced on
`bun`, whose `bigint` ceiling is lower than V8's). This is a user-facing
crash path, not just a missing error message: the existing
`length > maxLengthBytes` guard gives a false sense of safety because it
checks the wrong quantity.

### Proposal

**No size estimation.** Don't try to predict the escaped/serialized response
size anywhere (`cas_get` cannot see the final outer JSON-RPC encoding anyway —
that happens later, generically, in `mcpStep` / `writeResponse` — so any
estimate computed in `cas_get` would either have to duplicate that
serialization to be exact, or guess, which the JSON-escaping doubling above
already shows is easy to get wrong). Instead, make the one place that
actually performs the encoding fail soft instead of throwing:

`fs/mcp/stdio/module.f.ts` `writeResponse` should attempt the real encode —
`tryUtf8(stringifyJson(resp) + '\n')` instead of the total `utf8` — and on
`null` write a fallback response instead of letting the throw escape. The
fallback is a fixed, statically-small JSON-RPC error (reusing the existing
`internalError` — `rpcError(-32603)('Internal error')` — paired with `resp`'s
`id`, present on both the success and error branches of `Response`) that is
guaranteed to itself encode, since it carries no caller-controlled content.

This is the complete fix: it needs no companion guard in `cas_get`, handles
every shape of oversized response (binary via base64 inflation, text via
single or double JSON escaping, or anything else the JSON-RPC envelope might
add later), and matches the existing `try*`/`Nullable` convention — attempt
the real operation, branch on `null` — used everywhere else in this
codebase (`tryUtf8`, `tryListToVec`, `tryU8ListToVec`, `base64Decode`)
instead of computing a size bound up front. `cas_get` itself does not change:
its existing `length > maxLengthBytes` guard (an exact check on the *raw*
blob, not an estimate of encoded size) is unaffected and stays as a cheap
early reject for blobs that cannot possibly be materialized into one `Vec`
regardless of encoding.

### Tasks

- [ ] `fs/mcp/stdio/module.f.ts` `writeResponse`: switch from `utf8` to
      `tryUtf8`; on `null`, write the fixed `internalError` JSON-RPC response
      (with `resp.id`) instead of throwing.
- [ ] Proof tests: `fs/cas/mcp/proof.f.ts` / `fs/mcp/stdio/proof.f.ts`
      - A binary blob at exactly `maxLengthBytes` requested with
        `content: true` returns a clean error response (not a crash) once its
        base64 + JSON envelope overflows `maxLength`; confirm the boundary
        where it still succeeds.
      - A text blob made entirely of `"` / `\` / control characters, sized so
        the *raw* content is well under `maxLengthBytes` but the
        double-escaped final line would exceed `maxLength` — confirms
        `writeResponse`'s `tryUtf8` fallback (not a crash) handles it without
        any `cas_get`-level guard needing to predict the overflow.

### Related

- `fs/cas/mcp/todo/cas-add-inline-size-error.md` — the input-side counterpart
  (`cas_add` must not let `utf8`/`decode` throw); this issue is the
  output-side gap on `cas_get`.
- `fs/cas/mcp/module.f.ts` — `cas_get` `content: true` handler and its
  `length > maxLengthBytes` guard.
- `fs/mcp/stdio/module.f.ts` — `writeResponse`, which encodes every MCP
  response via the total `utf8`.
- `fs/text/module.f.ts` — `tryUtf8` (non-throwing) vs total `utf8`.
