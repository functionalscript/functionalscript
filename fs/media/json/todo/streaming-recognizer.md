## streaming-recognizer. A payload-free, O(depth) JSON validity recognizer

**Priority:** P3
**Status:** open

### Problem

`fs/media/json` can turn a stream into a value (`tokenize` → `parse`), but it has no
way to answer the cheaper question *"is this stream a valid JSON document?"*
without paying to build the value. Two independent costs make the existing
pipeline unfit as a validity check for a size-independent streaming consumer:

1. **The parser builds the whole value.** `parse`
   (`fs/media/json/parser/module.f.ts:232-238`) accumulates objects/arrays in
   `top`/`stack`, i.e. O(n) memory in the document size — even when the caller
   only wants a yes/no verdict.

2. **The tokenizer buffers token payloads.** The shared `fs/js` string and
   number states accumulate their text with `appendChar`
   (`ParseStringState.value`, `ParseNumberState.value` —
   `fs/js/tokenizer/module.f.ts:571-602,694-700`). A single huge token — e.g.
   `{"x":"⟨1 MB⟩"}` or one very long number — allocates O(token length) even
   before the parser runs. So a recognizer built by discarding only the parser's
   values still buffers whole tokens.

The immediate driver is `fs/media/type` (`fs/media/type/todo/detect-json.md`): its
`detectStream` classifier is deliberately O(1)-space over blobs larger than one
`Vec`, and it wants to fold JSON validity in alongside its UTF-8 / magic-byte
factors. It cannot adopt anything that is O(n) or O(token length). More broadly,
a validate-without-materialize primitive is generally useful (size checks,
guards, streaming ingestion) and belongs in `fs/media/json`, not hand-rolled in each
consumer.

### Proposal

Add a streaming JSON **recognizer** to `fs/media/json`: a per-code-point fold that
accepts/rejects a document using only a bounded bracket stack, buffering
neither values nor token payloads.

```ts
export type JsonRecognizerState = ...     // scanner sub-state × parser control × depth stack
export const recognizerInit: JsonRecognizerState
export const recognizerStep = (s: JsonRecognizerState, cp: number): JsonRecognizerState
export const recognizerAccepts = (s: JsonRecognizerState): boolean   // complete valid document at EOF?
```

**One grammar → one state machine → two builders.** The architecture is not
"two implementations kept equivalent by tests": there is a single grammar
description, it drives a single state machine, and that machine is
parameterized over a *builder*. `parse` is the machine instantiated with the
value-building builder; the recognizer is the **same machine** instantiated
with a no-op builder. Maximize shared code: the recognizer must not
re-implement any transition the parser already encodes, and `parse` itself
must be refactored to run on the shared machine — not left as a parallel copy
next to it. A standalone recognizer that re-derives the grammar is explicitly
out of scope, even if a test corpus shows it equivalent.

Concretely, reuse the existing grammar rather than writing a fourth JSON
parser; drop only the accumulation:

- **Payload-free scanning.** Reuse the tokenizer's *transition structure*
  (range-map dispatch, escape / `\uXXXX` / surrogate handling, number-shape DFA)
  but replace payload accumulation with recognition: strings and numbers need a
  small fixed-size sub-state (in-string / in-escape / hex-digit index; number
  phase int/frac/exp), not a growing `value`. The scanner emits *token
  boundaries and kinds*, not token text. The cleanest route is to factor the
  `fs/js` string/number ops over their "builder" so the recognizer instantiates
  them with a no-op builder (O(1) per token), the same way the value-free parser
  drops object/array construction — one grammar, two builders.

- **Value-free parsing.** Drive `fs/media/json/parser`'s per-token control machine
  (`foldOp` — `fs/media/json/parser/module.f.ts:205-224`) with a no-op value builder,
  keeping only `status` + a bracket stack. Space is **O(nesting depth)** — already
  strictly better than `parse`'s O(n) value. An **optional** max-depth cap
  (default: none) lets a consumer that needs a DoS guard bound the stack and
  reject deeper input. The cap is opt-in precisely because it is the one behavior
  where the recognizer would otherwise have to diverge from `parse` (see below);
  leaving it off keeps them equivalent.

- **Strictness.** Honor RFC 8259 at scan time. The raw-control-in-string
  rejection already lives in the shared `fs/js` tokenizer (`parseStringStateOp`),
  so the recognizer inherits it for free by reusing that scanner's string op
  (factored over a no-op builder, per the payload-free point above) rather than
  re-deriving the check.

Because the recognizer and the value-building `parse` run on the same state
machine over the same grammar, they cannot diverge **by construction** — the
point is one description of "valid JSON", read either into a value or into a
boolean. The equivalence proof below is then a regression check on the shared
machine, not the mechanism holding two implementations together. Correctness
property, scoped to make it actually hold:

- **With the depth cap disabled** (the default), `recognizerAccepts(s)` ⟺
  `parse(...)[0] === 'ok'` for **every** input — both share the shared
  tokenizer's strict-control rejection, so raw controls are not a divergence
  either. This is the equivalence proof.
- **With a finite cap**, agreement is scoped to inputs within the limit: a valid
  document nesting deeper than the cap is deliberately rejected even though
  `parse` (uncapped) accepts it. That is the intended DoS guard, not a bug —
  covered by a separate "over-cap document rejected" test, not by the equivalence
  proof. (`parse` is intentionally left uncapped; if a depth bound is ever wanted
  there too, that is its own change, not this recognizer's contract.)

### Tasks

- [ ] Factor the `fs/js` string/number token ops and the `fs/media/json` parser fold
      over their builders so one state machine serves both instantiations — the
      no-op builder yields the payload-free / value-free recognizer.
- [ ] Refactor `parse` to run on the shared, builder-parameterized machine (the
      value-building instantiation), so parser and recognizer use one state
      machine and one grammar — no parallel copy of the transitions survives.
- [ ] Implement `recognizerInit` / `recognizerStep` / `recognizerAccepts` with an
      O(depth) bracket stack and an **optional** max-depth cap (default: none);
      enforce RFC 8259 string-control strictness at scan time.
- [ ] Proof (cap disabled): `recognizerAccepts` agrees with `parse` `ok`/`error`
      across the existing parser test corpus; add large-single-token cases (huge
      string, long number) asserting bounded auxiliary space (no payload buffer).
- [ ] Proof (cap enabled): a valid document nesting deeper than a configured cap
      is rejected by `recognizerAccepts` — the DoS guard, scoped out of the
      equivalence above.
- [ ] `npx tsc` clean; `fjs t` green.

### Related

- `fs/media/json/parser/module.f.ts:205-238` — `foldOp` / `parse`; the control machine to reuse value-free.
- `fs/js/tokenizer/module.f.ts:571-602,694-700` — string/number states that buffer payloads and must gain payload-free variants.
- `fs/media/type/todo/detect-json.md` — first consumer; needs O(depth), payload-free validity to keep `detectStream` size-independent.
