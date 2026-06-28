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

Derive `cas_get` metadata with a **byte-accepting state machine** rather than
by buffering. The machine consumes bytes and transitions; at end-of-stream we
ask it for the meta properties. Crucially, this is not "buffer the prefix":
the `text` vs `base64` decision depends on whether the *whole* blob is valid
UTF-8 (a blob can be valid for the first 128 KB and go invalid on the last
byte), so any prefix buffer is incorrect — only a streaming validator that
sees every byte is. The state machine is the right shape for that, and length
and magic-byte detection fold into the same pass.

#### The state machine

A small immutable state with three independent sub-states, all folds over the
byte stream:

```ts
type DetectState = {
    readonly length: bigint     // running byte count
    readonly magic: MagicState  // viable signatures, or a resolved mime, or ruled-out
    readonly utf8: Utf8State     // DFA state: accepting / mid-sequence / invalid
}

// push bytes (one chunk at a time), then read off the answer at EOF
const push = (s: DetectState, bytes: Vec): DetectState => ...
const finish = (s: DetectState): { length: bigint, mime_type: string, type: 'text' | 'base64' } => ...
```

- **length** — increment by the chunk's byte length.
- **magic** — signature elimination: drop any signature whose byte at the
  current position doesn't match the incoming byte; commit when one fully
  matches (WebP's `RIFF`…`WEBP` gap handled as two anchored markers). This is
  the streaming form of today's `fs/mime` `detect` table and **settles within
  12 bytes** — thereafter it is in an absorbing state.
- **utf8** — a classic UTF-8 DFA (e.g. Höhrmann): accept byte, track whether
  we are at a code-point boundary, inside a multi-byte sequence, or have seen
  an illegal sequence. **Invalid is absorbing** — once invalid, always invalid.

`finish` reproduces today's three-way result: magic hit → `base64` + detected
mime; else `utf8` ended at a boundary with no invalidity → `text` +
`text/plain`; else → `base64` + `application/octet-stream`.

#### Why a state machine beats buffering

- **Correctness:** UTF-8 classification must see all bytes; a leading-bytes
  buffer cannot decide it. The DFA does it in O(1) space.
- **Cheap on large blobs:** both `magic` and `utf8` reach absorbing states
  early. Once `magic` is resolved and `utf8` can no longer change the outcome,
  `push` only needs `length += chunkBytes` — no per-byte iteration. A large
  blob costs ≈ length-counting regardless of size.
- **Composition:** three orthogonal folds in one pass; no buffer to size, no
  giant `Vec` to materialize. Fits the functional style of the module.
- **Simpler `cas_get`:** collapses the current three-phase branching into a
  single fold plus one `finish` lookup.

#### Wiring

1. **Add the state machine in `fs/mime`**, beside `detect` (the pure prefix
   form stays for callers that already hold a `Vec`). Provide `push` / `finish`
   plus a stream driver that folds the CAS read stream
   `List<O, IoResult<Vec>>` (each item an `Effect<O, IoResult<Vec>>` chunk),
   short-circuiting on a read `error` item into the `IoResult` error:

   ```ts
   export const detectStream =
       <O extends Operation>(stream: List<O, IoResult<Vec>>):
       Effect<O, IoResult<{
           readonly length: bigint
           readonly mime_type: string
           readonly type: 'text' | 'base64'
       }>>
   ```

2. **Use it in `cas_get`.** When `content` is not `true`, build the response
   from `detectStream(c.read(key))` alone — never call `collectRead`. Large
   blobs then return correct `{ length, mime_type, type, url }` instead of an
   error. Only when `content: true` is requested does the handler collect the
   bytes (the existing `collectRead` path / base64 or UTF-8 encoding), where
   the `maxLength` ceiling is a genuine limitation worth its own follow-up.

#### Rationale

- Separates *inspection* (cheap, streaming, size-independent) from *transfer*
  (bounded by `maxLength`). The metadata-only call should never fail on size.
- Keeps magic-byte logic in `fs/mime` where `detect` already lives; the state
  machine is the streaming counterpart of the pure one.
- Matches the documented `cas_get` decision protocol (inspect first, fetch
  later) by making the inspect step actually work for large blobs.

### Tasks

- [ ] Add the `DetectState` machine (`push` / `finish`) in `fs/mime`:
      length counter, signature-elimination magic matcher, UTF-8 DFA
- [ ] Add the `detectStream` driver folding the read stream through `push`
- [ ] Short-circuit `push` to length-only once `magic` and `utf8` are absorbed
- [ ] Rewire `cas_get` to use `detectStream` when `content !== true`
- [ ] Keep `collectRead` only on the `content: true` path
- [ ] Proof tests: large multi-chunk blob returns metadata (no error) with
      `content: false`; correct `type`/`mime_type` for text, png, octet-stream;
      a blob that is valid UTF-8 until a trailing invalid byte classifies as
      `base64`; `length` matches actual byte count
- [ ] Update `fs/cas/mcp/README.md` and the module JSDoc to note that
      metadata-only `cas_get` is size-independent

### Related

- [66j-cas-large-file-support](../../todo/66j-cas-large-file-support.md) —
  streaming upload; this is the read-side counterpart for `cas_get`
- `content: true` on a blob larger than `maxLength` is still unsupported and
  should be addressed separately (return via `url` instead of inline content)
