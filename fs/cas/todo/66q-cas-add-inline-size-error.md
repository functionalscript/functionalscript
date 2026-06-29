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

The single hard requirement: **the conversion must not throw on `bun`** — an
unhandled throw inside the MCP server crashes the process. So the `Vec`-building
operations **return `Nullable<Vec>` (`null`) instead of throwing** when the result would
exceed `maxLength`, and the `cas_add` handler turns `null` into a normal `isError` tool
result. This keeps the library simple — no `Result` tuple or error-union to thread
through; callers that have already validated the size just add `!` or
`assert(vec !== null)`.

We stay on `null` (not `undefined`) because `Nullable<T> = T | null` is the codebase's
documented absence convention (`fs/types/nullable/module.f.ts`, with `map` / `match` /
`toOption` / `fromUndefined` helpers), and `base64.decode` already returns
`Nullable<Vec>`. Switching to `undefined` would either leave the library mixing `null`
and `undefined` or imply a codebase-wide convention change — out of scope here.

1. **`fs/types/bit_vec/module.f.ts`** — the constructor / `concat` that can produce an
   over-`maxLength` `Vec` returns `Nullable<Vec>` (`null` instead of building a `bigint`
   past the ceiling that would throw on `bun`). This is the single place the "discourage
   large bit vectors" guidance is enforced; `utf8` and `decode` inherit it.
2. **`fs/base64/module.f.ts` `decode`** — **no signature change**: it stays
   `Nullable<Vec>` and simply returns `null` for over-`maxLength` input instead of
   throwing (today it returns `null` only for malformed base64).
3. **`fs/text/module.f.ts` `utf8`** — return `Nullable<Vec>` (`null` only when the encoded
   length would exceed `maxLength`, since every string is otherwise valid to
   UTF-8-encode).
4. **`cas_add` handler (`fs/cas/mcp/module.f.ts`)** — on `null` from `utf8` / `decode`,
   return a generic *content decoding error* `isError` result. No branching on the cause
   is needed: the `cas_add` / `cas_get` tool descriptions already document the 128 KiB
   inline limit and point oversized content at `type: 'url'`, so the static message can
   simply restate that (the content could not be decoded — it may be malformed or above
   the 128 KiB inline limit; use `type: 'url'` for large content).

Reuse the byte-aligned limit constants already exported from
`fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

### Open questions

- Exactly which `bit_vec` operations gain the `Nullable<Vec>` return (the public
  constructor, `concat`, `u8ListToVec`, …) and whether a small shared "checked build"
  helper is cleaner than touching each.

### Tasks

- [ ] Make the over-`maxLength` `bit_vec` build operation(s) return `Nullable<Vec>`
      (`null`) instead of throwing.
- [ ] Make `fs/base64` `decode` return `null` (not throw) for over-`maxLength` input;
      signature stays `Nullable<Vec>`.
- [ ] Make `fs/text` `utf8` return `Nullable<Vec>` (`null` only when the encoded length
      would exceed `maxLength`).
- [ ] In the `cas_add` handler, treat `null` from `utf8` / `decode` as a generic content
      decoding error `isError` (static message that also points at `type: 'url'` for
      large content).
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
