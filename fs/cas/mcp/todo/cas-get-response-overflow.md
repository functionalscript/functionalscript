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
  can expand up to ~4× by the time both escaping passes are done (e.g. a
  literal `"` → `\"` after the inner pass → `\\\"` after the outer pass). A
  guard that sizes only the *inner* CAS JSON/raw content therefore still
  underestimates the final line for adversarial text and can let a payload
  through whose final line exceeds `maxLength`.
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

The transport fix is the one that must be exact; the `cas_get`-level guard can
only ever be a conservative early-reject, because `cas_get`'s handler does not
see the final outer JSON-RPC encoding (that happens later, generically, in
`mcpStep` / `writeResponse`) and a precise bound would require duplicating
that serialization. So:

1. **Make the transport non-throwing (authoritative).**
   `fs/mcp/stdio/module.f.ts` `writeResponse` should use `tryUtf8` instead of
   the total `utf8`, and on `null` write a fallback error response (e.g. a
   `-32603`-style internal-error line sized well under `maxLength`) instead of
   letting the throw escape. This is what actually guarantees no crash,
   regardless of how badly any guard upstream underestimates — it protects
   every MCP response, not just `cas_get`'s.
2. **Tighten the `cas_get` guard as a conservative early-reject**, not as the
   source of truth. Bound the *inner* CAS JSON size using a worst-case
   escaping multiplier rather than the raw content size:
   - `type: 'base64'`: the alphabet (`A-Za-z0-9+/=`) contains no characters
     JSON needs to escape, so `ceil(length / 3) * 4` bytes plus the fixed
     envelope overhead is already a tight, correct bound — no multiplier
     needed here.
   - `type: 'text'`: a single inner-JSON-escaped character (`"`, `\`, or a
     control character) can itself need escaping again once embedded in the
     outer envelope's `text` field (see Problem). Use a conservative
     worst-case multiplier (4×, matching the `"` → `\"` → `\\\"` chain) on
     `length` rather than trying to special-case which characters are
     present; this trades some false positives (an oversized-looking but
     actually-fine text blob gets the early `errorResult` instead of
     succeeding) for a bound that cannot be wrong in the unsafe direction.
   Treat this as a cheap optimisation that returns the existing
   `errorResult` sooner with a clearer message — (1) remains the backstop
   that must hold even if this estimate is off.

This mirrors the `cas-add-inline-size-error` precedent (an optional, provably
sound — never unsafe — early check, with the authoritative `null`/non-throw
path as the real fix) and is the output-side counterpart to `cas_add`'s
input-side handling.

### Tasks

- [ ] `fs/mcp/stdio/module.f.ts` `writeResponse`: switch from `utf8` to
      `tryUtf8`; on `null`, write a typed fallback error response instead of
      throwing. (Authoritative fix — required regardless of task below.)
- [ ] `fs/cas/mcp/module.f.ts` `cas_get`: replace the raw `length >
      maxLengthBytes` check (the `content: true` branch) with a conservative
      check against the *escaped* response size: exact `ceil(length/3)*4` +
      envelope for `base64`; `length × 4` (worst-case escaping) + envelope for
      `text`.
- [ ] Proof tests: `fs/cas/mcp/proof.f.ts`
      - A binary blob at exactly `maxLengthBytes` requested with
        `content: true` returns a clean `isError` (not a crash) once its
        base64 + envelope would overflow; confirm the boundary where it still
        succeeds.
      - A text blob made entirely of `"` / `\` / control characters, sized so
        the *raw* content is well under `maxLengthBytes` but the
        double-escaped final line would exceed `maxLength` — confirms
        `writeResponse`'s `tryUtf8` path (not a crash) handles whatever the
        `cas_get` guard's conservative estimate misses.

### Related

- `fs/cas/mcp/todo/cas-add-inline-size-error.md` — the input-side counterpart
  (`cas_add` must not let `utf8`/`decode` throw); this issue is the
  output-side gap on `cas_get`.
- `fs/cas/mcp/module.f.ts` — `cas_get` `content: true` handler and its
  `length > maxLengthBytes` guard.
- `fs/mcp/stdio/module.f.ts` — `writeResponse`, which encodes every MCP
  response via the total `utf8`.
- `fs/text/module.f.ts` — `tryUtf8` (non-throwing) vs total `utf8`.
