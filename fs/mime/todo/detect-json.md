## detect-json. Detect JSON and return `application/json`

**Priority:** P3
**Status:** open

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
factor already decodes.

```ts
type JsonState = {
    readonly parse: ...   // parser control state (a StateParse-like status)
    readonly tok: ...     // tokenizer mid-token state (inside a string/number/keyword)
}
const jsonInit: JsonState
const jsonStep = (j: JsonState, cp: number): JsonState  // one code point → next state
const jsonValid = (j: JsonState): boolean               // read at EOF: complete valid document?
```

`push` (`:235-247`) already iterates bytes and calls `utf8Step`, which decodes
0-or-1 code points per byte via `utf8ByteToCodePointOp`. Feed each decoded code
point into `jsonStep` in the same loop — the JSON factor rides the code points
the UTF-8 factor produces, exactly as the UTF-8 factor rides the raw bytes. (It
is a mild coupling to the existing "factors never read each other" note at
`:199-200`; document it, or, if strict independence is preferred, give the JSON
factor its own `utf8ByteToCodePointOp` decode — at the cost of decoding twice.)

#### 2. Reuse the existing JSON grammar — do not re-implement it

`fs/json` already has the grammar as composable state machines, and the whole
point of the single-classifier design is to avoid a second, divergent copy of a
rule set:

- `fs/json/tokenizer/module.f.ts` — a `stateScan` per-char (code point) machine
  producing `JsonToken`s.
- `fs/json/parser/module.f.ts` — `foldOp: (token) => (state) => JsonState`
  (`:205-224`), a clean per-token pushdown fold with an explicit `stack`; `parse`
  (`:232`) accepts on final `status === 'result'`, rejects on `'error'` or an
  incomplete `default` (`'unexpected end'`).

Compose them incrementally: `code point → tokenizer step → 0+ tokens → foldOp
step(s) → parser state`; at EOF flush the tokenizer (`eof`) and accept iff the
parser reached `result`. This reuses the tested grammar rather than hand-rolling
a fourth JSON parser.

**Value-discarding is required for streaming.** `parse` builds the whole value
in `top`/`stack` (O(n) memory), which defeats the O(1)-space streaming the
metadata path depends on (a >128 KiB blob has no single `Vec`; the point of
`detectStream` is size-independence). We only need accept/reject, so extract a
**recognizer**: keep the parser's control state and bracket stack, drop value
construction. Preferred: parameterize the parser over a "builder" so a no-op
builder yields a pure recognizer with **O(depth)** space (nesting depth only);
fallback: a small bespoke pushdown automaton mirroring `foldOp`'s status/stack.
Cap nesting depth (reject past the cap) so a pathological `[[[[…` input cannot
grow the stack without bound.

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

#### 4. What counts as JSON (decide the top-level rule)

RFC 8259 admits any value as a JSON text, so `42`, `"hi"`, `true`, `null` are
technically valid JSON — but they are also perfectly ordinary `text/plain`, and
flipping a file containing just `null` to `application/json` is surprising.
**Recommendation: require the top-level value to be an object or array** (first
non-whitespace code point is `{` or `[`). This matches how JSON is used as a
data format and avoids misclassifying trivial/short text, at the cost of not
labeling a bare top-level scalar as JSON. Document whichever rule is chosen next
to the signature table (`:18-31`) and in `fs/cas/mcp/module.f.ts`'s `cas_get`
output section. NDJSON / JSON Lines / JSON5 are out of scope.

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

- [ ] Extract a value-discarding streaming JSON **recognizer** from
      `fs/json` (parameterize `parser` over a no-op builder, or a bespoke
      pushdown mirroring `foldOp`); enforce a max-depth cap.
- [ ] Add the `A_json` factor to `DetectState`/`detectInit`; drive `jsonStep`
      from the code points decoded in `push`.
- [ ] Refine `finish` to emit `application/json` for whole-blob-valid UTF-8
      that is also valid JSON (per the chosen top-level rule).
- [ ] Add `fs/mime/proof.f.ts` cases: `{"a":1}` and `[1,2,3]` (incl. split
      across chunks) → `application/json`/`text`; trailing garbage after valid
      JSON and truncated JSON → `text/plain`; non-JSON prose → `text/plain`;
      bare scalar `42` → per the chosen rule.
- [ ] Update `fs/mime/module.f.ts` module doc (recognised-types table) and the
      `cas_get` output section in `fs/cas/mcp/module.f.ts` to list
      `application/json`.
- [ ] `npx tsc` clean; `fjs t` green with both branches of the JSON verdict
      covered.

### Related

- `fs/mime/module.f.ts:264-272` — `finish`, where the text→JSON refinement lands.
- `fs/mime/module.f.ts:180-195` — the UTF-8 factor whose decoded code points feed the JSON factor.
- `fs/json/parser/module.f.ts:205-238` — `foldOp` / `parse`, the reusable per-token pushdown grammar.
- `fs/json/tokenizer/module.f.ts` — the per-code-point scanner to compose in front of the parser.
- `fs/cas/mcp/module.f.ts:196-204` — `cas_get`, the consumer that gains `application/json` for free.
- `fs/mime/todo/single-signature-table.md` — the sibling "one source of truth" cleanup; same single-classifier principle.
