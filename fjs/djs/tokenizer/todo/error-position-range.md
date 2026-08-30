## Report token errors as a position range

**Priority:** P3
**Status:** done — an error token that knows how far its source runs carries an
`end`, the parser passes it through, and `errorLocation` renders the span.
What remains speculative is deliberately left out; see **What was not done**.

### Problem

An error token carried one `TokenMetadata` (`{ path, line, column }`,
`fjs/js/tokenizer/types.ts`) — a single point. For errors whose whole
meaning is a span, one point cannot say what the reader needs.

Unterminated tokens are the clear case. The grammar *matches* an unterminated
string and tags it `unterminated`, so `tokenizeJs` takes the structural-error
path and reported the position of the token's **start**:

| Input | Reported | Where the input ran out |
|---|---|---|
| `"value` | 1:1 | 1:7 |
| `"unterminated` | 1:1 | 1:14 |
| `"a\nb"` | 1:1 | 2:3 |

The start is a defensible anchor — TypeScript reports "Unterminated string
literal" at the opening quote too — so this was not a wrong-position bug. The
gap was that only one of the two useful positions survived.

### What landed

Option 1 of the original proposal: a span on **error tokens only**, every other
token's `metadata` staying a point.

- `ErrorToken` gained an optional `end?: TokenPosition`, where `TokenPosition`
  is `TokenMetadata` without the path — the path is stated once, on the start,
  because a token does not straddle files. This satisfies the no-duplication
  requirement without a `TokenRange` pair type: the start already lives in
  `JsTokenWithMetadata.metadata`, so a self-contained range on the token would
  have duplicated it.
- It is optional because not every error token knows an end. The DJS layer
  remaps a `JsToken` it cannot accept into an error while holding no positions
  at all (`mapDjsToken`, `parseDjsMinusState`), so a required field was never
  available: absent means "the tokenizer knows where, not how far".
- Two of the three error sites in `tokenizeJs` carry one: the partial-match
  `invalid token` and the unterminated-comment `*/ expected`, both spanning to
  where the input ran out. `invalid number` deliberately does **not** — its
  anchor is the character that *spoiled* the number, so the source it is about
  ends where the anchor starts, and a forward span from the anchor cannot
  describe it. Giving it one would mean moving the anchor, which changes a
  reported position for no consumer.
- `ParseError` in `fjs/djs/parser/types.ts` gained the same optional `end`, and
  `splitEof` passes a lexical error's span through — the one parser failure
  that has a span to pass. A *grammar* failure points at one token, and a
  token's extent is not recorded, so it stays a point.
- `errorLocation` in `fjs/djs/module.f.mjs` renders the span:
  `path:line:column-column` within one line, `path:line:column-line:column`
  across several, the plain point when there is no end.

Pinned end to end: the `errorPosition` proof group in
`fjs/djs/tokenizer/proof.f.mjs` asserts each span (or its absence) through
`errorAt`, and `parseError` in `fjs/djs/proof.f.mjs` pins the three rendered
forms through the compiler, which is the proof that a lexical span survives
tokenizer → parser → `errorLocation`.

### What was not done

Option 2 — widening every token's `metadata` to a range — stays speculative,
and this section is what decides it later. The BNF parser matches rules over
whole tokens, so every rule it reduces has a first and a last token and
therefore a natural span; `export default <value>` is a span, not a point.
Whenever a *formatter* wants rule spans, every token needs an end, and that is
the moment to widen `JsTokenWithMetadata.metadata` rather than grow more
special cases. Until then a grammar failure prints the point form, which the
`point` proof in `fjs/djs/proof.f.mjs` pins.

### Tasks

- [x] Choose the shape — `end?: TokenPosition` on `ErrorToken`, not a
      `TokenRange` pair, so the start is stated once
- [x] Carry the start position through the structural-error path so both ends
      are available where the error is built
- [x] Make the unterminated-comment and unterminated-string cases agree — both
      anchor at the construct's opening
- [x] Pass the span through `ParseError` and render it in `errorLocation`
- [x] Update the `errorPosition` and `metadata` proof groups
- [x] `npx tsc`, `fjs t`

### Related

- [the DJS parser](../../parser/README.md) — the second consumer in waiting:
  rule spans are the case that turns option 2 real.
- [../../../bnf/descent/README.md](../../../bnf/descent/README.md#failure-reporting)
  — `DescentFailure` reports the furthest rejected position. It does **not**
  cover this case: an unterminated token is a successful match with a tag, not a
  failed one, so no descent failure is involved.
- [error-message-specificity](./error-message-specificity.md) — every error is
  the same `'invalid token'` string; complementary, and both are needed before
  the tokenizer can produce a useful diagnostic.
