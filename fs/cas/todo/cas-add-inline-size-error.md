## cas-add-inline-size-error. Reject oversized `cas_add` inline content as a `decoding error`

**Priority:** P3
**Status:** open
**Blocked by:** —

### Scope

This issue is now narrowed to the **MCP `cas_add` handler**
(`fs/cas/mcp/module.f.ts`). The bit-vector / codec groundwork it used to describe
is already in place:

- `fs/types/bit_vec/module.f.ts` has the bounded core: `tryListToVec` /
  `tryU8ListToVec` return `Nullable<Vec>` (running-length guard, `null` past
  `maxLength`); the total `listToVec` / `u8ListToVec` are `mapUnwrap` wrappers.
- `fs/types/nullable/module.f.ts` exports `unwrap` / `mapUnwrap`.
- `fs/text/module.f.ts` has `tryUtf8` (`Nullable<Utf8>`, `null` only past
  `maxLength`); `utf8` is the total `mapUnwrap` wrapper.
- `fs/base64/module.f.ts` `decode` returns `null` for over-`maxLength` input
  (its `stringToVec` core is now `Nullable`) as well as for malformed input.

The two remaining base64 edge cases are tracked separately and are **out of scope
here**: `fs/base64/todo/encode-padding-overflow.md` and
`fs/base64/todo/decode-rejects-max-size-input.md`.

### Problem

The 128 KiB (`maxLength`) cap on `cas_add` inline content is **intentional**, not
a defect to be lifted — it gives uniform behaviour across JS engines (a single
`Vec` is a `bigint`, and `bun`/JSC caps `bigint` size lower than V8), bounds LLM
token spend, and steers large blobs onto the `type: 'url'` path. The MCP tool
descriptions already document the limit and point oversized content at
`type: 'url'`.

What is left is that `cas_add` does not yet turn an over-cap inline payload into a
**clean error on every engine**:

- **`type: 'text'` still uses the throwing `utf8`** (`x = pure(utf8(content))`).
  `utf8` is the `mapUnwrap` wrapper, so an over-`maxLength` string makes it
  `throw` — and on `bun` that is an unhandled throw that **crashes the MCP
  server** rather than returning an error result. This is the core un-fixed case.
- **`type: 'base64'` already returns `null`** from `base64Decode`, but the
  handler maps every `null` to `invalid base64 content: ${content}`. Now that
  `decode` also returns `null` for over-`maxLength` (not just malformed) input,
  that message is misleading for the size case and echoes the entire (large)
  `content` back into the response.

### Proposal

Keep the handler the one place that must **not** assume the inline size is
bounded, and collapse both failure causes into a single generic *decoding error*.

1. **Use the non-throwing encoder for `text`.** Switch the `text` branch from the
   total `utf8` to `tryUtf8`, so an over-`maxLength` string yields `null` instead
   of throwing. Import `tryUtf8` (drop the `utf8` import if it becomes unused).

2. **One generic `decoding error` for both `null`s.** When `tryUtf8(content)` or
   `base64Decode(content)` returns `null`, return an `isError` result with a
   single static message — do not branch on the cause and do not echo `content`
   back. The message restates the documented contract, e.g.:

   > content could not be decoded — it may be malformed or above the 128 KiB
   > inline limit; use `type: 'url'` for large content.

   This replaces the current `invalid base64 content: ${content}` string.

3. **Additional up-front check (optional, cheap).** Before decoding, a UTF-16
   `content.length` is a fast lower bound on the encoded byte length; an explicit
   guard can short-circuit the obvious over-cap case with the same `decoding
   error` before building any `Vec`. The authoritative check stays the `null`
   from `tryUtf8` / `base64Decode` (UTF-8 expansion and base64's 3/4 ratio mean
   string length alone is not exact), so this is only an optimisation, not a
   correctness requirement. Reuse the limit constants already exported from
   `fs/types/bit_vec/module.f.ts` (`maxLength`, `maxLengthBytes`).

`cas_add` never `unwrap`s the inline `Vec`: the over-cap signal ends only as the
`isError` result above. (`type: 'url'` is unaffected — it already streams.)

### Tasks

- [ ] `fs/cas/mcp/module.f.ts` `cas_add`: replace `utf8(content)` with
      `tryUtf8(content)` on the `text` branch.
- [ ] `fs/cas/mcp/module.f.ts` `cas_add`: map `null` from `tryUtf8` **and** from
      `base64Decode` to one generic `decoding error` `isError` result (static
      message that also points at `type: 'url'`; no `content` echo, no
      cause-branching).
- [ ] Confirm imports: bring in `tryUtf8` from `fs/text/module.f.ts`; remove the
      now-unused `utf8` import if nothing else uses it.
- [ ] Proof tests `fs/cas/mcp/proof.f.ts`: inline `text` and `base64` at exactly
      `maxLengthBytes` (stored cleanly) and one byte over (clean `isError` on
      every engine — not a thrown crash, not a silently-stored over-`maxLength`
      blob). Add a `base64OfA(n)` helper spelling out base64 of `n` ASCII `'a'`
      bytes for every `n % 3` residue, so the boundary sample never drives the
      encoder past `maxLength`.
- [ ] Confirm the inline-limit wording in `fs/cas/mcp/README.md` and the `cas_add`
      tool description still matches the implemented behaviour.

### Related

- `fs/cas/mcp/module.f.ts` — the `cas_add` handler (and the `cas_get`
  `content: true` oversized-blob guard, already implemented, that it mirrors).
- `fs/text/module.f.ts` — `tryUtf8` (non-throwing) vs total `utf8`.
- `fs/base64/module.f.ts` — `decode` returns `null` on malformed **and**
  over-`maxLength` input.
- `fs/types/bit_vec/module.f.ts` — `tryListToVec` / `tryU8ListToVec` bounded core;
  `maxLength` / `maxLengthBytes` constants.
- `fs/types/nullable/module.f.ts` — `unwrap` / `mapUnwrap`.
- `fs/base64/todo/encode-padding-overflow.md`,
  `fs/base64/todo/decode-rejects-max-size-input.md` — the remaining codec edge
  cases, tracked separately.
