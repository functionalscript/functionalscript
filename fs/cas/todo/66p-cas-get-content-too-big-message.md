## 66P-cas-get-content-too-big-message. `cas_get({ content: true })` reports oversized blobs as "not found"

**Priority:** P3
**Status:** open
**Blocked by:** —

### Problem

In `fs/cas/mcp/module.f.ts`, `cas_get` with `content: true` materializes the blob
through `collectRead`, which is bounded by a single `Vec`'s `maxLength` (128 KiB).
When the blob exceeds that ceiling, `collectRead` returns a descriptive error item:

```ts
// fs/cas/mcp/module.f.ts:136-138
if (bitVecLength(acc) + bitVecLength(v) > maxLength) {
    return pure(error(`cas blob exceeds maximum vector length of ${maxLength} bits`))
}
```

But the `content: true` handler collapses **every** error result — a genuinely
absent hash *and* the "too big" error above — into the same message:

```ts
// fs/cas/mcp/module.f.ts:225-227
return collectRead(c.read(key)).step(result => {
    if (result[0] === 'error') {
        return pure(errorResult(`no such hash: ${r.hash}`))
    }
    ...
```

So a blob that exists but is larger than 128 KiB is misreported to the MCP client
as `no such hash`. The descriptive "exceeds maximum vector length" message produced
upstream is discarded. The client cannot tell the difference between "this hash is
not in the store" and "this hash is stored but too large to fetch inline."

The metadata-only path (`content` omitted/false) is already size-independent — it
streams through `fs/mime` `detectStream` and returns correct
`{ length, mime_type, type, url }` for any size — so the blob *is* discoverable; only
the inline-content fetch fails, and it fails with the wrong message.

### Proposal

Distinguish the two error cases in the `content: true` arm and surface a proper
message for the oversized case, pointing the client at the size-independent
alternatives (metadata-only `cas_get`, or fetching the bytes out of band via the
`url` field):

- Keep `no such hash: ${r.hash}` only for the genuine "absent hash" case
  (`c.read` yields no/short-circuit error from the store).
- For the "blob exceeds `maxLength`" case, return a distinct message such as
  *"blob too large to fetch inline (N bytes, limit 128 KiB); use the `url` field or
  omit `content` for metadata"* — ideally carrying the actual size and the `url`
  already computed at the top of the handler.

Mechanically this needs `collectRead`'s two failure modes to be distinguishable by
the caller (e.g. a tagged/typed error rather than a bare string, or a separate
size pre-check using the size-independent length the metadata path already
computes), so the handler can branch instead of flattening both into one string.

Consider sharing the size knowledge with the metadata path: `detectStream` already
yields `length` without buffering, so the handler could compute `length` first and
short-circuit `content: true` with the proper "too large" message *before* calling
`collectRead` at all.

### Tasks

- [ ] Make `collectRead`'s "exceeds maxLength" failure distinguishable from a store
      "not found" error at the call site (typed error variant, or pre-check size).
- [ ] In the `content: true` arm of `cas_get`, return a distinct, descriptive
      "blob too large to fetch inline" message (include size and `url`), keeping
      `no such hash` only for genuinely absent hashes.
- [ ] Add proof cases in `fs/cas/mcp/proof.f.ts`: (a) `content: true` on an absent
      hash → "no such hash"; (b) `content: true` on a present blob larger than
      `maxLength` → the new "too large" message, not "no such hash".
- [ ] Run `npx tsc` and `fjs t`; confirm coverage on both error arms.
- [ ] Note the inline-content size limit in `fs/cas/mcp/README.md` if not already
      documented.

### Related

- [66j-cas-readfile-size-limit](66j-cas-readfile-size-limit.md) — `readFile`
  size-limit handling on the read path (metadata side; this issue is the
  `content: true` inline-fetch side).
- [66k-cas-get-return-path](66k-cas-get-return-path.md) — returning a path/URL for
  large blobs so clients can fetch oversized content out of band.
- [66n-cas-get-response-shape](66n-cas-get-response-shape.md) — response-shaping
  cleanup in the same handler.
