## 66Q-cas-add-inline-size-error. Reject oversized `cas_add` inline content gracefully

**Priority:** P3
**Status:** open
**Blocked by:** —

### Problem

The 128 KiB (`maxLength`) cap on `cas_add` inline content is **intentional and
desirable**, not an accident to be lifted. It applies only to *inlined* MCP content
(`type: 'text'` / `type: 'base64'`); `cas_add({ type: 'url', … })` and reading via the
`cas_get` `url` field already handle content of any size. We keep the inline cap on
purpose:

- **Uniform behaviour across JS engines.** A single `Vec` is a `bigint`. Every JS
  engine caps `bigint` size, but the cap differs: `bun` (WebKit/JSC) has the *smallest*
  limit and throws first, while `node`/`deno` (V8) allow much larger `bigint`s and so
  do *not* throw at 128 KiB (see the `maxLength` notes in
  `fs/types/bigint/module.f.ts`). So today the effective inline limit is
  engine-dependent. We want the *same* explicit 128 KiB limit and the *same* behaviour
  on every JS engine.
- **LLM token economy.** 128 KiB is a sensible ceiling that stops an LLM from burning
  tokens transferring large files inline; large blobs belong on the `url` path.
- **Library guidance.** We deliberately discourage large bit vectors. Big data should
  be partitioned and streamed, not loaded into memory as one piece.

The defect is only that the cap is **not enforced as a clean error**. The conversion
that builds the `Vec` runs *before* the `cas_add` handler can react:

- `type: 'text'` → `utf8(content)` (`fs/text/module.f.ts`)
- `type: 'base64'` → `decode(content)` (`fs/base64/module.f.ts`)

Each builds an over-`maxLength` `Vec`, so a size guard placed in the handler *after*
the conversion is too late: on `bun` the conversion has already thrown (crash), and on
`node`/`deno` it silently produces an over-`maxLength` blob that gets stored and then
cannot be read back inline via `cas_get` `content: true`. The MCP tool descriptions for
`cas_add` and `cas_get` already document the 128 KiB inline limit and steer callers to
`type: 'url'`; this issue is about making the runtime match that contract identically on
every engine.

### Proposal

Enforce `maxLength` *inside* the conversion functions and report the failure as data,
so the `cas_add` handler can turn it into a normal `isError` tool result instead of a
crash or a silently-stored oversized blob.

**Add new size-checked operations** alongside the existing ones rather than changing
the current signatures — `decode` (`Nullable<Vec>`) and `utf8` (`string → Vec`) stay as
they are for callers that do not need the check. The new operations share a
`Result<Vec, DecodeErrorType>` return shape with a string-union error type, so both
report failures consistently and the handler can tell the two cases apart:

```ts
// fs/types/result/module.f.ts — shared so both fs/base64 and fs/text import it
type DecodeErrorType = 'tooBig' | 'invalid'
```

1. **`fs/base64/module.f.ts`** — add a size-checked decode (working name `tryDecode`)
   returning `Result<Vec, DecodeErrorType>`: `error('invalid')` for malformed base64,
   `error('tooBig')` when the decoded `Vec` would exceed `maxLength` bits (checked
   *before* constructing the over-`maxLength` `bigint`). Keep the existing
   `decode: Nullable<Vec>`.
2. **`fs/text/module.f.ts`** — add a size-checked encode (working name `tryUtf8`)
   returning `Result<Vec, DecodeErrorType>` (it only ever yields `error('tooBig')`,
   since every string is valid to UTF-8-encode). Keep the existing total `utf8`; the new
   variant can wrap it behind the size check.
3. **`cas_add` handler (`fs/cas/mcp/module.f.ts`)** — call the new operations and match
   on the error:
   - `'tooBig'` → `errorResult(...)` naming the byte size and 128 KiB limit and
     pointing at `type: 'url'` (mirroring the existing oversized-blob guard on the
     `cas_get` `content: true` path);
   - `'invalid'` → the existing `invalid base64 content` error.

Final operation names are to be decided; the point is that they are *additional*, so no
existing caller of `decode` / `utf8` is affected.

Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

`DecodeErrorType` lives in `fs/types/result/module.f.ts` (the common `Result` home),
so both `fs/base64` and `fs/text` import it without either depending on the other.

### Open questions

- Exact names for the new operations (`tryDecode` / `tryUtf8` are placeholders).
- Whether the new operations check the size themselves, or share a low-level
  `bit_vec` helper that rejects over-`maxLength` construction (so the "discourage large
  bit vectors" guidance is enforced in one place). Either way the existing `decode` /
  `utf8` stay unchanged.

### Tasks

- [ ] Define `DecodeErrorType = 'tooBig' | 'invalid'` in `fs/types/result/module.f.ts`.
- [ ] Add a size-checked decode to `fs/base64` returning `Result<Vec, DecodeErrorType>`
      (reject over-`maxLength` input as `error('tooBig')` before building the `bigint`);
      keep the existing `decode: Nullable<Vec>`.
- [ ] Add a size-checked `utf8` variant in `fs/text` returning
      `Result<Vec, DecodeErrorType>`; keep the existing total `utf8`.
- [ ] Point the CAS MCP handler at the new operations and map `'tooBig'` → size/limit
      `isError` recommending `type: 'url'`, `'invalid'` → the existing base64 error.
- [ ] Add proof tests in `fs/cas/mcp/proof.f.ts`: inline `text` and `base64` content at
      `maxLengthBytes` (stored) and just above (clean `isError` on every engine — not a
      thrown crash and not a silently-stored over-`maxLength` blob).
- [ ] Confirm the documented inline limit in `fs/cas/mcp/README.md` and the `cas_add`
      tool description match the implemented behaviour.

### Related

- `fs/cas/mcp/module.f.ts` — `cas_add` handler and the `cas_get` `content: true`
  oversized-blob guard it should mirror.
- `fs/types/bigint/module.f.ts` — `maxLength` notes on `bun` throwing near the ceiling.
- `fs/cas/mcp/README.md` — documents the 128 KiB inline limit and the `type: 'url'`
  alternative.
