## detect-json. Detect JSON and return `application/json`

**Priority:** P3
**Status:** blocked
**Blocked by:** [fjs/media/json streaming-recognizer](../../json/todo/streaming-recognizer.md)

### Problem

The MCP server classifies stored content by content-sniffing, not by any
stored type: `cas_get` folds the read stream through the `fjs/media/type` detector
(`detectStream`) and reports `{ length, mime_type, type }`. The detector's
`finish` in `fjs/media/type/module.f.mjs` produces a three-way verdict:

1. magic-byte hit (PNG/JPEG/GIF/WebP/PDF/ZIP) → `base64` + the detected mime;
2. whole-blob-valid UTF-8 text → `text` + `text/plain`;
3. otherwise → `base64` + `application/octet-stream`.

JSON has no magic-byte signature, so a stored JSON document is valid UTF-8
text and falls into bucket (2): it comes back as `text/plain`. An MCP client
that inspects `mime_type` to decide how to route or render the blob cannot
tell a JSON document from arbitrary prose. The detector should recognize
well-formed JSON and report `application/json` (RFC 8259 / RFC 6838; UTF-8 is
the assumed charset, so no `charset` parameter is emitted).

Because the classifier is shared, fixing it in `fjs/media/type` fixes it everywhere:
`cas_get` (in `fjs/mcp/cas/module.f.mjs`) picks up `application/json`
automatically for both the metadata-only and `content: true` paths, and any
future `fjs/media/type` consumer inherits it.

### Proposal

Add JSON as a **refinement of the text branch**, keeping the single-classifier
design (one machine, read off at EOF — no second, divergent copy of the rules)
that the module documents beside `finish` and `detectVec`.

#### 1. A fourth fold factor: a streaming JSON recognizer

The detector state (`DetectState`) is a product of independent factors — bit
`length` × `MagicState` × `Utf8Detect` — that meet only in `finish`. Add a
fourth factor `A_json`: a streaming JSON **recognizer** (accept/reject only, no
value construction) fed by the same stream. Its core is the `fjs/media/json`
recognizer (§2), created through its capped entry point with this detector's
cap (§5); `fjs/media/type` wraps it with a one-code-point tag recording the
first non-whitespace code point, so the object/array-only policy (§4) is
applied at EOF — the recognizer stays pure (accepts any valid JSON), the MIME
policy lives here.

What the recognizer consumes — bytes, code points or UTF-16 code units — is
[streaming-recognizer](../../json/todo/streaming-recognizer.md)'s to settle;
the earlier sketch here was written against a per-code-unit signature that
design has withdrawn. Whatever it takes, the factor must feed it exactly that
alphabet: `U16` and `CodePoint` are both `number`, so feeding code points where
code units are expected is invisible to `tsc`. If the factor rides the code
points `utf8Step` already decodes in `push`, that is a mild coupling to the
module's "factors never read each other" note; document it, or give the JSON
factor its own decode — at the cost of decoding twice.

#### 2. Consume the `fjs/media/json` streaming recognizer — do not hand-adapt the reader here

`A_json` is exactly the *"is this stream valid JSON?"* question, and it must be
answered without buffering — otherwise the size-independence `detectStream` is
built for is lost. Reusing `fjs/media/json`'s `parse` as-is does **not** work,
for reasons that are `fjs/media/json`'s to own, not `fjs/media/type`'s to
patch: it builds the whole value — O(n) memory in the document size — its
string mappings build each string's text, O(token length) on a single huge
string such as metadata-only `cas_get` on `{"x":"⟨1 MB⟩"}`, and the parser
under it takes the whole input as one array.

All of that is addressed by the payload-free, O(depth) recognizer proposed in
[streaming-recognizer](../../json/todo/streaming-recognizer.md), sharing the
grammar with `parse` so they cannot diverge, with an optional max-depth cap this
detector **enables**. `A_json` is the thin §1 wrapper over it — the recognizer
plus the one-code-point top-level tag — adding no JSON grammar of its own. This
todo therefore **depends on** that recognizer landing first.

Strictness note: the recognizer must reject raw U+0000–U+001F inside strings,
already refused by JSON's own grammar — `character` in `fjs/ebnf/lib/json`
admits nothing below U+0020 outside an escape. This
matters here because `fjs/media/type`'s text gate admits TAB/VT/FF as text
(`utf8Step`/`isTextCodePoint`), so without the strict check a blob like
`{"a":"⟨TAB⟩"}` — invalid JSON per RFC 8259 — would be mislabeled
`application/json`. `A_json` inherits the correct verdict from the recognizer
rather than re-deriving it.

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

`jsonValid` is the recognizer accepting at EOF with a top tag of `{` or `[`.
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
next to the module doc's signature table and in `fjs/mcp/cas/module.f.mjs`'s
`cas_get` output section. NDJSON / JSON Lines / JSON5 are out of scope.

#### 5. `isSettled` / performance

No asymptotic regression on the text path. `isSettled` already
never settles a live-text blob (magic `dead` + valid text keeps scanning), so
confirming whole-blob UTF-8 validity already forces a full scan of every text
blob — JSON validity, also only knowable at EOF, rides that same scan for free.
The magic-matched early exit (`pdfThenLargeTextTail`) is untouched. The only new
cost is the recognizer's O(depth) stack, bounded by the depth cap.

**The cap is a fixed number here, not a knob**, and that is a contract rather
than a tuning choice: a detector is asked *what type is this blob*, so two
implementations disagreeing about the limit would return different MIME
verdicts for the same bytes. `64` is the proposed value — far past anything a
real document reaches, and shallow enough that the stack is bounded by a
constant rather than by input — and it belongs in this design because
`fjs/media/json` has no opinion about it.

**And the cap can be refused.** The recognizer's capped `try…` entry point
returns `null` for anything outside the finite non-negative integers, because a
rejecting state would make this detector answer `text/plain` for every valid
JSON blob with no way for anyone to tell that from bad content — read
[streaming-recognizer](../../json/todo/streaming-recognizer.md) before building
the initializer.

**Here the `null` is unwrapped, not defaulted**, and the first draft of this
paragraph got that wrong in a way worth keeping on the record. It fell back to
the uncapped recognizer and called the fallback unreachable, existing "only so
the type checks without a cast" — which is a silent uncapping. If the initializer
ever did return `null` for `64`, after a regression or a later edit to the
constant, the detector would quietly run **uncapped** and report
`application/json` for a 65-deep blob, hiding the exact boundary this design
promises. That is a plausible wrong verdict standing in for a refusal: the
defect this whole change exists to remove, reintroduced one level up, inside
the commit removing it. `doc/REVIEW.md` draws the line — a caller who may
legitimately supply the input gets a `try*` and a `Nullable`, a broken
**precondition** gets a panic — and `64` is a literal, so this call site is the
precondition case. `unwrap` from `fjs/types/nullable` asserts and returns the
state, so the `null` is discharged once here and never reaches the
per-code-point path.

**A number is not yet a contract**, which review caught this paragraph
asserting in the sentence above and then not delivering: `64` decides nothing
until what it counts is pinned. It is the greatest number of containers open
**at once**, defined with the initializer in
[streaming-recognizer](../../json/todo/streaming-recognizer.md), so a blob
whose deepest point has 64 open containers is still JSON to this detector and
one with 65 is not. Two implementations that read `64` as levels-from-one and
as open-containers differ on exactly the documents at the boundary, which is
the disagreement this paragraph exists to prevent. So the detector owes both
boundary cases as tests, not just the rejecting one: 64 nested containers
detected as JSON, 65 not — on arrays and on objects, since the two need not
share a push. Leave
`isSettled` as-is (a text blob cannot settle early regardless of the JSON
factor).

#### 6. Scope: `finish`/stream only, not `detect`

The pure `detect(Vec)` is a leading-bytes magic lookup; JSON cannot
be recognized from a fixed prefix (a trailing `}` or stray byte decides
validity), so `detect` keeps returning `null` for JSON. Only the whole-blob /
streaming path (`finish`, `detectVec`, `detectStream`) gains JSON — which is
exactly the path `cas_get` uses.

### Tasks

- [ ] Land the payload-free, O(depth) `fjs/media/json` recognizer first (its own
      todo); this issue is blocked on it.
- [ ] Add the `A_json` factor (recognizer + top-level `top` tag, §1) to
      `DetectState`/`detectInit`; drive it from `push`, in the alphabet the
      recognizer takes.
- [ ] Refine `finish` to emit `application/json` for whole-blob-valid UTF-8 that
      is valid JSON **with an object/array top level** (§4 decision).
- [ ] Add `fjs/media/type/proof.f.mjs` cases: `{"a":1}` and `[1,2,3]` (incl. split
      across chunks) → `application/json`/`text`; trailing garbage after valid
      JSON and truncated JSON → `text/plain`; non-JSON prose → `text/plain`;
      a raw TAB inside a string (`{"a":"⟨TAB⟩"}`) → `text/plain`, not
      `application/json`; bare scalars (`42`, `null`, `"hi"`, `true`) →
      `text/plain` (top-level object/array rule).
- [ ] Add the **depth-cap boundary** cases, which this design promises above and
      which the recognizer's own cap proofs cannot stand in for: a blob nesting
      **64** containers is `application/json`, one nesting **65** is
      `text/plain`, on arrays and on objects. They belong here because what they
      catch is *this* module's wiring — initialising with the uncapped
      recognizer instead of the capped one, passing `63` or `65` for the cap,
      or feeding only one container path through the factor — and every other
      detector case listed above passes all of those while deeply nested blobs
      get the wrong MIME verdict.
- [ ] Update `fjs/media/type/module.f.mjs` module doc (recognised-types table) and the
      `cas_get` output section in `fjs/mcp/cas/module.f.mjs` to list
      `application/json`.
- [ ] `tsc` clean; `fjs t` green with both branches of the JSON verdict
      covered.

### Related

- `fjs/media/type/module.f.mjs` — `finish`, where the text→JSON refinement
  lands, and `utf8Step`, the UTF-8 factor beside which the JSON factor runs.
- [streaming-recognizer](../../json/todo/streaming-recognizer.md) — **blocks
  this**; the payload-free, O(depth) validity recognizer `A_json` wraps.
- `fjs/ebnf/lib/json/module.f.mjs` — `character`; refuses raw U+0000–U+001F inside strings, so `A_json` inherits the correct verdict without re-deriving it.
- `fjs/media/json/parser/module.f.mjs` — `parse`, over the grammar the
  recognizer reuses value-free.
- `fjs/mcp/cas/module.f.mjs` — `cas_get`, the consumer that gains `application/json` for free.
