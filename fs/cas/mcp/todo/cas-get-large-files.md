## `cas_get` fails on large blobs even without content

**Priority:** P3
**Status:** open

### Problem

`cas_get` always drains the whole blob into a single `Vec` before it can
answer, even when the caller only asked for metadata.

In `fs/cas/mcp/module.f.ts` the handler does:

```ts
return collectRead(c.read(key)).step(result => { ... })
```

`collectRead` concatenates every chunk of the read stream
(`List<O, IoResult<Vec>>`) into one `Vec`. A single `Vec` cannot exceed
`maxLength` bits, so for any blob larger than one chunk (`maxLengthBytes`,
128 KiB) the concatenation eventually trips:

```ts
if (bitVecLength(acc) + bitVecLength(v) > maxLength) {
    return pure(error(`cas blob exceeds maximum vector length of ${maxLength} bits`))
}
```

So `cas_get` returns an error for large blobs **even with the default
`content: false`** — the exact case where the caller wants only
`{ length, mime_type, type, url }` and is deliberately avoiding the byte
transfer. The whole point of the metadata-only call (inspect size and type,
decide whether to fetch via `url` or `content: true`) is defeated: the agent
can never learn that a blob is large because the inspection itself fails.

This also wastes memory and time. The metadata `cas_get` returns is derivable
without holding the full blob:

- `length` — sum of the chunk lengths.
- `mime_type` / `type` via magic-byte sniffing — only needs the leading bytes
  (`fs/mime` `detect` looks at the first 12 bytes / 96 bits at most, for WebP).
- `mime_type: text/plain` / `type: text` via UTF-8 validation — can be checked
  incrementally per chunk instead of over one giant `Vec`.

### Proposal

Add a function that derives `cas_get` metadata directly from the read stream,
without ever collecting the content, and use it in `fs/cas/mcp`.

1. **New stream MIME/metadata detector** (in `fs/mime`, beside `detect`).
   It consumes the CAS read stream `List<O, IoResult<Vec>>` (each item an
   `Effect<O, IoResult<Vec>>` chunk) and returns the metadata only:

   ```ts
   export const detectStream =
       <O extends Operation>(stream: List<O, IoResult<Vec>>):
       Effect<O, IoResult<{
           readonly length: bigint            // total bytes, summed across chunks
           readonly mime_type: string
           readonly type: 'text' | 'base64'
       }>>
   ```

   While draining the stream it:
   - buffers only the leading bytes needed to run the existing `detect`
     (≤ 96 bits) — once `detect` returns non-`null`, the magic-byte answer is
     fixed and later chunks no longer need to be inspected for it;
   - feeds each chunk to an incremental UTF-8 validator so the `text` vs
     `base64` decision is reached without materializing the whole blob;
   - accumulates the total length from chunk lengths;
   - discards chunk content as it goes, so memory stays bounded regardless of
     blob size;
   - surfaces a read `error` item as the `IoResult` error.

   The three-way result mirrors today's phases: magic-byte hit → `base64` +
   detected mime; else valid UTF-8 → `text` + `text/plain`; else → `base64` +
   `application/octet-stream`.

2. **Use it in `cas_get`.** When `content` is not `true`, build the response
   from `detectStream(c.read(key))` alone — never call `collectRead`. Large
   blobs then return correct `{ length, mime_type, type, url }` instead of an
   error. Only when `content: true` is requested does the handler collect the
   bytes (the existing `collectRead` path / base64 or UTF-8 encoding), where
   the `maxLength` ceiling is a genuine limitation worth its own follow-up.

#### Rationale

- Separates *inspection* (cheap, streaming, size-independent) from *transfer*
  (bounded by `maxLength`). The metadata-only call should never fail on size.
- Keeps magic-byte logic in `fs/mime` where `detect` already lives; the stream
  variant is the streaming counterpart of the pure one.
- Matches the documented `cas_get` decision protocol (inspect first, fetch
  later) by making the inspect step actually work for large blobs.

### Tasks

- [ ] Add `detectStream` (streaming MIME + UTF-8 + length) in `fs/mime`
- [ ] Add an incremental UTF-8 validator (or reuse one) for per-chunk checking
- [ ] Rewire `cas_get` to use `detectStream` when `content !== true`
- [ ] Keep `collectRead` only on the `content: true` path
- [ ] Proof tests: large multi-chunk blob returns metadata (no error) with
      `content: false`; correct `type`/`mime_type` for text, png, octet-stream;
      `length` matches actual byte count
- [ ] Update `fs/cas/mcp/README.md` and the module JSDoc to note that
      metadata-only `cas_get` is size-independent

### Related

- [66j-cas-large-file-support](../../todo/66j-cas-large-file-support.md) —
  streaming upload; this is the read-side counterpart for `cas_get`
- `content: true` on a blob larger than `maxLength` is still unsupported and
  should be addressed separately (return via `url` instead of inline content)
