## 666-js-tokenizer-position-layer. Separate position/metadata tracking from the JS tokenizer core

**Priority:** P4
**Status:** open

### Problem

> **Premise inverted (2026-08).** The citations below came from a longer
> version of a module that is now 745 lines, and are corrected. More than the
> numbers moved: `tokenizeOp` is gone because its dispatch was **inlined into
> the position layer**, so the separation this issue opens by taking for
> granted no longer exists. That strengthens the case rather than weakening it
> — see below. Line citations tracked in
> [tokenizer-line-citations](./tokenizer-line-citations.md).

`fjs/js/tokenizer/module.f.mjs` has the two halves of a clean split — a pure
character-to-token dispatch over `tokenizeEofOp` / `tokenizeCharCodeOp`, and
line/column/path bookkeeping — but they are **fused into one function**. The
dispatch used to stand alone as `tokenizeOp`; today it survives only as the two
branches of the metadata layer (`fjs/js/tokenizer/module.f.mjs:697-707`):

```ts
// fjs/js/tokenizer/module.f.mjs:697 — the pure dispatch, inlined
const tokenizeWithPositionOp
    : StateScan<CharCodeOrEof, TokenizerStateWithMetadata, List<JsTokenWithMetadata>>
    = (input, {state, metadata}) => {
        if (input == null) {           //< was tokenizeOp's eof branch
            const newState = tokenizeEofOp(state)
            return [listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata }]
        }
        const newState = tokenizeCharCodeOp(input, state)   //< was tokenizeOp's other branch
        const isNewLine = input == lf
        const newMetadata = { path: metadata.path, line: isNewLine ? metadata.line + 1 : ..., column: ... }
        return [ listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata: newMetadata}]
    }

export const tokenize  // :712 — the ONLY public entry point; always emits metadata
    = input => path => { ... }
```

Because the dispatch is inlined and the metadata layer is fused into `tokenize`,
a consumer that doesn't want positions cannot get bare tokens — there is no
pure operator left to call. This is the source of friction downstream: the
JSON tokenizer passes an empty path purely to *discard* the position info it never
wanted (`fjs/media/json/tokenizer/module.f.mjs` calls `jsTokenize(input)('')`), while the
DJS tokenizer threads metadata everywhere. Both build on the same core but each
fights the single metadata-coupled entry point.

### Proposal

Separate the two concerns:

1. **Extract the pure dispatch back out**, as the `tokenizeOp` this issue was
   written against — `(input, state) => input == null ? tokenizeEofOp(state) :
   tokenizeCharCodeOp(input, state)` — and have `tokenizeWithPositionOp` call
   it instead of repeating both branches. Then **expose a raw entry point** over
   it yielding `List<JsToken>` without metadata (`tokenizeRaw`), which JSON's
   tokenizer consumes directly instead of supplying a dummy path and throwing
   positions away. The extraction is step zero now; when this issue was written
   it was already done.
2. (Optional, defer until a second consumer) Express position tracking as a
   standalone generic combinator
   `StateScan<C, S, List<T>> → StateScan<C, {state:S, metadata}, List<{token:T, metadata}>>`,
   with newline detection passed in, so `tokenizeWithPositionOp` becomes one
   application of it. Per the repo's "extract at the second consumer" rule, the
   generic combinator has no second consumer yet — so the immediate, justified step
   is just (1): exposing the raw/no-metadata entry point.

This is a separation-of-concerns improvement: the lexical core and the source-
position bookkeeping become independently consumable, which also tidies the JSON
tokenizer's dummy-path workaround.

### Tasks

- [ ] re-extract `tokenizeOp` from `tokenizeWithPositionOp`'s two branches
- [ ] export a `tokenizeRaw` (no-metadata) entry point built on `tokenizeOp`
- [ ] ~~export a `tokenizeRaw` (no-metadata) entry point built on
      `tokenizeOp`~~ and ~~switch `fjs/media/json/tokenizer` to consume it
      instead of `jsTokenize(input)('')`~~ — **superseded, do not build
      either.** JSON stops consuming `fjs/js/tokenizer` at all; see
      [self-contained-tokenizer](../../media/json/todo/self-contained-tokenizer.md).

      JSON was `tokenizeRaw`'s only proposed consumer, and there is no other:
      `fjs/djs/tokenizer` imports just `isKeywordToken` and `mergeTrivia` from
      this module and drives its own `tokenizeJs`
      (`fjs/djs/tokenizer/module.f.mjs:544`), so it never wanted a bare JS
      token stream either. Building the export anyway would add an unused
      public API, which is exactly what this issue's own
      defer-until-a-second-consumer principle forbids.

      What survives is task 1 alone — re-extracting `tokenizeOp` so
      `tokenizeWithPositionOp` stops repeating both branches — which is an
      internal tidy-up justified without any consumer.
- [ ] (defer) generic `withPosition` combinator once a second consumer appears

### Related

- `fjs/js/tokenizer/module.f.mjs` — the fused operator `tokenizeWithPositionOp`
  (:697-707), public entry `tokenize` (:712), and the two halves the dispatch
  still calls, `tokenizeCharCodeOp` (:647) and `tokenizeEofOp` (:667)
- [i157](../../djs/todo/157-json-djs-shared-value-machine.md) — JSON/DJS value-layer sharing; the dummy-path
  workaround in `json/tokenizer` is downstream of this coupling
