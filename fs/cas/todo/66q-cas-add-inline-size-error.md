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

- **Uniform behaviour across JS engines.** A single `Vec` is a `bigint`, and a
  `bigint` over `maxLength` bits *throws on `bun`* but is *accepted on `node`/`deno`*
  (see the `maxLength` notes in `fs/types/bigint/module.f.ts`). So today the effective
  inline limit is engine-dependent. We want the *same* explicit 128 KiB limit and the
  *same* behaviour on every JS engine.
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

Use a `Result<Vec, DecodeErrorType>` return shape, with a shared string-union error
type, so both conversions report failures consistently and the handler can tell the
two cases apart:

```ts
// fs/base64 (or a shared location both modules import)
type DecodeErrorType = 'too-big' | 'invalid'
```

1. **`fs/base64/module.f.ts` `decode`** — change from `Nullable<Vec>` to
   `Result<Vec, DecodeErrorType>`: `error('invalid')` for malformed base64,
   `error('too-big')` when the decoded `Vec` would exceed `maxLength` bits (checked
   *before* constructing the over-`maxLength` `bigint`). The only in-`fs` caller is the
   CAS MCP handler (`fs/cas/mcp/module.f.ts`), so the migration is contained.
2. **`fs/text/module.f.ts` `utf8`** — add a fallible variant returning
   `Result<Vec, DecodeErrorType>` for consistency with `decode` (it only ever yields
   `error('too-big')`, since every string is valid to UTF-8-encode). Keep the existing
   total `utf8` for callers that do not need the size check, or have the new variant
   wrap it.
3. **`cas_add` handler (`fs/cas/mcp/module.f.ts`)** — match on the error:
   - `'too-big'` → `errorResult(...)` naming the byte size and 128 KiB limit and
     pointing at `type: 'url'` (mirroring the existing oversized-blob guard on the
     `cas_get` `content: true` path);
   - `'invalid'` → the existing `invalid base64 content` error.

Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

### Open questions

- Where should `DecodeErrorType` live — in `fs/base64` and imported by `fs/text`, or in
  a shared `fs/types` location? Pick whichever keeps the dependency direction clean.
- Should the size check live in a low-level `bit_vec` constructor (so *any* over-
  `maxLength` `Vec` construction fails uniformly and `utf8` / `decode` inherit it)
  rather than being duplicated in each conversion? That would generalize the
  "discourage large bit vectors" guidance, at the cost of a wider API change.

### Tasks

- [ ] Define `DecodeErrorType = 'too-big' | 'invalid'` in a shared location.
- [ ] Change `fs/base64` `decode` to `Result<Vec, DecodeErrorType>`; reject over-
      `maxLength` input as `error('too-big')` before building the `bigint`.
- [ ] Update the CAS MCP handler (the only in-`fs` `decode` caller) to the new shape.
- [ ] Add a fallible `utf8` variant returning `Result<Vec, DecodeErrorType>`.
- [ ] In the `cas_add` handler, map `'too-big'` → size/limit `isError` recommending
      `type: 'url'`, and `'invalid'` → the existing base64 error.
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
