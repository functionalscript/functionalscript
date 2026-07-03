## detect-json. Detect JSON and return `application/json`

**Priority:** P3
**Status:** blocked
**Blocked by:** [fs/json streaming-recognizer](../../json/todo/streaming-recognizer.md), [fs/json reject-unescaped-string-controls](../../json/todo/reject-unescaped-string-controls.md)

### Problem

The MCP server classifies stored content by content-sniffing, not by any
stored type: `cas_get` folds the read stream through the `fs/mime` detector
(`detectStream`) and reports `{ length, mime_type, type }`. The detector's
`finish` (`fs/mime/module.f.ts:264-272`) produces a three-way verdict:

1. magic-byte hit (PNG/JPEG/GIF/WebP/PDF/ZIP) → `base64` + the detected mime;
2. whole-blob-valid UTF-8 text → `text` + `text/plain`;
3. otherwise → `base64` + `application/octet-stream`.

JSON has no magic-byte signature, so a stored JSON document is valid UTF-8
text and falls into bucket (2): it comes back as `text/plain`. An MCP client
that inspects `mime_type` to decide how to route or render the blob cannot
tell a JSON document from arbitrary prose. The detector should recognize
well-formed JSON and report `application/json` (RFC 8259 / RFC 6838; UTF-8 is
the assumed charset, so no `charset` parameter is emitted).

Because the classifier is shared, fixing it in `fs/mime` fixes it everywhere:
`cas_get` (`fs/cas/mcp/module.f.ts:204`) picks up `application/json`
automatically for both the metadata-only and `content: true` paths, and any
future `fs/mime` consumer inherits it.

### Proposal

Add JSON as a **refinement of the text branch**, keeping the single-classifier
design (one machine, read off at EOF — no second, divergent copy of the rules)
that the module documents at `fs/mime/module.f.ts:96-105`.

#### 1. A fourth fold factor: a streaming JSON recognizer

The detector state (`DetectState`, `:201-205`) is a product of independent
factors — bit `length` × `MagicState` × `Utf8Detect` — that meet only in
`finish`. Add a fourth factor `A_json`: a streaming JSON **recognizer**
(accept/reject only, no value construction) driven by the code points the UTF-8
factor already decodes. Its core is the `fs/json` recognizer (§2); `fs/mime`
wraps it with a one-code-point tag recording the top-level value's kind, so the
object/array-only policy (§4) is applied at EOF — the recognizer stays pure
(accepts any valid JSON), the MIME policy lives here:

```ts
// A_json state, added to DetectState (init { rec: recognizerInit, top: null }):
type JsonFactor = { readonly rec: JsonRecognizerState; readonly top: Nullable<number> }
// per decoded code point: feed the recognizer; remember the first non-whitespace cp
const jsonStep = ({ rec, top }: JsonFactor, cp: number): JsonFactor => ({
    rec: recognizerStep(rec, cp),
    top: top ?? (isJsonWhitespace(cp) ? null : cp),   // ws = 0x20/0x09/0x0A/0x0D
})
// at EOF: a complete valid document whose top-level value is an object or array
const jsonValid = ({ rec, top }: JsonFactor): boolean =>
    recognizerAccepts(rec) && (top === 0x7b /* { */ || top === 0x5b /* [ */)
```

`push` (`:235-247`) already iterates bytes and calls `utf8Step`, which decodes
0-or-1 code points per byte via `utf8ByteToCodePointOp`. Feed each decoded code
point into `jsonStep` in the same loop — the JSON factor rides the code points
the UTF-8 factor produces, exactly as the UTF-8 factor rides the raw bytes. (It
is a mild coupling to the existing "factors never read each other" note at
`:199-200`; document it, or, if strict independence is preferred, give the JSON
factor its own `utf8ByteToCodePointOp` decode — at the cost of decoding twice.)

#### 2. Consume the `fs/json` streaming recognizer — do not hand-adapt the tokenizer here

`A_json` is exactly the *"is this stream valid JSON?"* question, and it must be
answered without buffering — otherwise the size-independence `detectStream` is
built for is lost. Reusing `fs/json`'s `tokenize`/`parse` as-is does **not**
work for two reasons that are `fs/json`'s to own, not `fs/mime`'s to patch:

- `parse` builds the whole value in `top`/`stack` — O(n) memory in the document
  size.
- the shared `fs/js` tokenizer buffers each token's payload
  (`ParseStringState.value` / `ParseNumberState.value`, appended per character),
  so even a value-discarding parser still allocates O(token length) on a single
  huge string or number — e.g. metadata-only `cas_get` on `{"x":"⟨1 MB⟩"}`.

Both are addressed by the payload-free, O(depth) recognizer proposed in
**`fs/json/todo/streaming-recognizer.md`** (`recognizerInit` / `recognizerStep`
/ `recognizerAccepts`, sharing the grammar with `parse` so they cannot diverge,
with an optional max-depth cap `fs/mime` should enable as a DoS guard). `A_json`
is the thin §1 wrapper over it — the recognizer plus the one-code-point
top-level tag — adding no JSON grammar of its own. This todo therefore **depends
on** that recognizer landing first.

Strictness note: the recognizer must reject raw U+0000–U+001F inside strings
(`fs/json/todo/reject-unescaped-string-controls.md`). This matters here because
`fs/mime`'s text gate admits TAB/VT/FF as text (`utf8Step`/`isTextCodePoint`), so
without the strict check a blob like `{"a":"⟨TAB⟩"}` — invalid JSON per RFC 8259
— would be mislabeled `application/json`. `A_json` inherits the correct verdict
from the recognizer rather than re-deriving it.

#### 3. `finish`: refine text → JSON

```ts
const mime = magicMime(s.magic)
if (mime !== null) { return { length: byteLength, mime_type: mime, type: 'base64' } }
if (utf8Text(s.utf8) && (s.length & 0b111n) === 0n) {
    return jsonValid(s.json)
        ? { length: byteLength, mime_type: 'application/json', type: 'text' }
        : { length: byteLength, mime_type: 'text/plain',       type: 'text' }
}
return { length: byteLength, mime_type: 'application/octet-stream', type: 'base64' }
```

JSON stays `type: 'text'` (it is UTF-8 text); only `mime_type` sharpens. The
magic branch is unaffected — no known signature is valid JSON, and a magic hit
already short-circuits, so JSON folding never runs on a magic-matched blob.

#### 4. What counts as JSON (decided)

**Decision: only a document whose top-level value is an object or array** (first
non-whitespace code point `{` or `[`) is classified `application/json`. A bare
top-level scalar — `42`, `"hi"`, `true`, `null` — stays `text/plain`, even
though RFC 8259 admits it as a valid JSON text.

Rationale: bare scalars are also perfectly ordinary text, and flipping a file
containing just `null` or `42` to `application/json` is surprising and unstable
(one short line of prose that happens to be a JSON number would change MIME
type). The object/array gate matches how JSON is used as a data format and is
what §1's `top` tag enforces (`jsonValid` requires `top ∈ { '{', '[' }`). The
externally visible contract, then: `cas_get` returns `application/json` only for
object/array documents; scalar-only blobs report `text/plain`. Document this
next to the signature table (`:18-31`) and in `fs/cas/mcp/module.f.ts`'s
`cas_get` output section. NDJSON / JSON Lines / JSON5 are out of scope.

#### 5. `isSettled` / performance

No asymptotic regression on the text path. `isSettled` (`:221-227`) already
never settles a live-text blob (magic `dead` + valid text keeps scanning), so
confirming whole-blob UTF-8 validity already forces a full scan of every text
blob — JSON validity, also only knowable at EOF, rides that same scan for free.
The magic-matched early exit (`pdfThenLargeTextTail`) is untouched. The only new
cost is the recognizer's O(depth) stack, bounded by the depth cap. Leave
`isSettled` as-is (a text blob cannot settle early regardless of the JSON
factor).

#### 6. Scope: `finish`/stream only, not `detect`

The pure `detect(Vec)` (`:88-94`) is a leading-bytes magic lookup; JSON cannot
be recognized from a fixed prefix (a trailing `}` or stray byte decides
validity), so `detect` keeps returning `null` for JSON. Only the whole-blob /
streaming path (`finish`, `detectVec`, `detectStream`) gains JSON — which is
exactly the path `cas_get` uses.

### Tasks

- [ ] Land the payload-free, O(depth) `fs/json` recognizer and the
      strict-string-controls fix first (their own todos); this issue is blocked
      on them.
- [ ] Add the `A_json` factor (recognizer + top-level `top` tag, §1) to
      `DetectState`/`detectInit`; drive `jsonStep` from the code points decoded
      in `push`.
- [ ] Refine `finish` to emit `application/json` for whole-blob-valid UTF-8 that
      is valid JSON **with an object/array top level** (§4 decision).
- [ ] Add `fs/mime/proof.f.ts` cases: `{"a":1}` and `[1,2,3]` (incl. split
      across chunks) → `application/json`/`text`; trailing garbage after valid
      JSON and truncated JSON → `text/plain`; non-JSON prose → `text/plain`;
      a raw TAB inside a string (`{"a":"⟨TAB⟩"}`) → `text/plain`, not
      `application/json`; bare scalars (`42`, `null`, `"hi"`, `true`) →
      `text/plain` (top-level object/array rule).
- [ ] Update `fs/mime/module.f.ts` module doc (recognised-types table) and the
      `cas_get` output section in `fs/cas/mcp/module.f.ts` to list
      `application/json`.
- [ ] `npx tsc` clean; `fjs t` green with both branches of the JSON verdict
      covered.

### Related

- `fs/mime/module.f.ts:264-272` — `finish`, where the text→JSON refinement lands.
- `fs/mime/module.f.ts:180-195` — the UTF-8 factor whose decoded code points feed the JSON factor.
- `fs/json/todo/streaming-recognizer.md` — **blocks this**; the payload-free, O(depth) validity recognizer `A_json` wraps.
- `fs/json/todo/reject-unescaped-string-controls.md` — **blocks this**; without it a raw-control string would be mislabeled `application/json`.
- `fs/json/parser/module.f.ts:205-238` — `foldOp` / `parse`, the grammar the recognizer reuses value-free.
- `fs/cas/mcp/module.f.ts:196-204` — `cas_get`, the consumer that gains `application/json` for free.
- `fs/mime/todo/single-signature-table.md` — the sibling "one source of truth" cleanup; same single-classifier principle.
