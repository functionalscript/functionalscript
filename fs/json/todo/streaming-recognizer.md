## streaming-recognizer. A payload-free, O(depth) JSON validity recognizer

**Priority:** P3
**Status:** open

### Problem

`fs/json` can turn a stream into a value (`tokenize` → `parse`), but it has no
way to answer the cheaper question *"is this stream a valid JSON document?"*
without paying to build the value. Two independent costs make the existing
pipeline unfit as a validity check for a size-independent streaming consumer:

1. **The parser builds the whole value.** `parse`
   (`fs/json/parser/module.f.ts:232-238`) accumulates objects/arrays in
   `top`/`stack`, i.e. O(n) memory in the document size — even when the caller
   only wants a yes/no verdict.

2. **The tokenizer buffers token payloads.** The shared `fs/js` string and
   number states accumulate their text with `appendChar`
   (`ParseStringState.value`, `ParseNumberState.value` —
   `fs/js/tokenizer/module.f.ts:571-602,694-700`). A single huge token — e.g.
   `{"x":"⟨1 MB⟩"}` or one very long number — allocates O(token length) even
   before the parser runs. So a recognizer built by discarding only the parser's
   values still buffers whole tokens.

The immediate driver is `fs/mime` (`fs/mime/todo/detect-json.md`): its
`detectStream` classifier is deliberately O(1)-space over blobs larger than one
`Vec`, and it wants to fold JSON validity in alongside its UTF-8 / magic-byte
factors. It cannot adopt anything that is O(n) or O(token length). More broadly,
a validate-without-materialize primitive is generally useful (size checks,
guards, streaming ingestion) and belongs in `fs/json`, not hand-rolled in each
consumer.

### Proposal

Add a streaming JSON **recognizer** to `fs/json`: a per-code-point fold that
accepts/rejects a document using only a bounded bracket stack, buffering
neither values nor token payloads.

```ts
export type JsonRecognizerState = ...     // scanner sub-state × parser control × depth stack
export const recognizerInit: JsonRecognizerState
export const recognizerStep = (s: JsonRecognizerState, cp: number): JsonRecognizerState
export const recognizerAccepts = (s: JsonRecognizerState): boolean   // complete valid document at EOF?
```

Reuse the existing grammar rather than writing a fourth JSON parser; drop only
the accumulation:

- **Payload-free scanning.** Reuse the tokenizer's *transition structure*
  (range-map dispatch, escape / `\uXXXX` / surrogate handling, number-shape DFA)
  but replace payload accumulation with recognition: strings and numbers need a
  small fixed-size sub-state (in-string / in-escape / hex-digit index; number
  phase int/frac/exp), not a growing `value`. The scanner emits *token
  boundaries and kinds*, not token text. The cleanest route is to factor the
  `fs/js` string/number ops over their "builder" so the recognizer instantiates
  them with a no-op builder (O(1) per token), the same way the value-free parser
  drops object/array construction — one grammar, two builders.

- **Value-free parsing.** Drive `fs/json/parser`'s per-token control machine
  (`foldOp` — `fs/json/parser/module.f.ts:205-224`) with a no-op value builder,
  keeping only `status` + a bracket stack. Space is **O(nesting depth)**, with a
  configurable max-depth cap (reject beyond it) so `[[[[…` cannot grow the stack
  unbounded.

- **Strictness.** Honor RFC 8259 at scan time, including the raw-control-in-string
  rejection tracked in `fs/json/todo/reject-unescaped-string-controls.md` (the
  recognizer scans, so it enforces it directly rather than inheriting a lax
  token).

The recognizer and the value-building `parse` must share the grammar so they can
never diverge — the point is one description of "valid JSON", read either into a
value or into a boolean. `recognizerAccepts` must agree with `parse(...)[0] ===
'ok'` on every input (modulo the strict-control fix, which both should adopt);
make that a proof.

### Tasks

- [ ] Factor the `fs/js` string/number token ops and the `fs/json` parser fold
      over their builders so a no-op builder yields payload-free / value-free
      variants (or add dedicated recognizer ops sharing the transition tables).
- [ ] Implement `recognizerInit` / `recognizerStep` / `recognizerAccepts` with an
      O(depth) bracket stack and a max-depth cap; enforce RFC 8259 string-control
      strictness at scan time.
- [ ] Proof: `recognizerAccepts` agrees with `parse` `ok`/`error` across the
      existing parser test corpus; add large-single-token cases (huge string,
      long number) asserting bounded auxiliary space (no payload buffer); add a
      deep-nesting case hitting the depth cap.
- [ ] `npx tsc` clean; `fjs t` green.

### Related

- `fs/json/parser/module.f.ts:205-238` — `foldOp` / `parse`; the control machine to reuse value-free.
- `fs/js/tokenizer/module.f.ts:571-602,694-700` — string/number states that buffer payloads and must gain payload-free variants.
- `fs/json/todo/reject-unescaped-string-controls.md` — the strictness this recognizer must enforce at scan time.
- `fs/mime/todo/detect-json.md` — first consumer; needs O(depth), payload-free validity to keep `detectStream` size-independent.
