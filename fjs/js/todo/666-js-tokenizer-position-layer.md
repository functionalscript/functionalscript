## 666-js-tokenizer-position-layer. Separate position/metadata tracking from the JS tokenizer core

**Priority:** P4
**Status:** open

### Problem

`fjs/js/tokenizer/module.f.ts` already factors its character-to-token state machine
cleanly into a pure core that produces bare tokens:

```ts
// fjs/js/tokenizer/module.f.ts:887-889
const tokenizeOp
    : StateScan<CharCodeOrEof, TokenizerState, List<JsToken>>
    = (input, state) => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(input, state)
```

But the **line/column/path metadata** concern is interleaved on top of that core
and hard-wired into the only public entry point:

```ts
// fjs/js/tokenizer/module.f.ts:895-908
const tokenizeWithPositionOp
    : StateScan<CharCodeOrEof, TokenizerStateWithMetadata, List<JsTokenWithMetadata>>
    = (input, {state, metadata}) => {
        ...
        const isNewLine = input == lf
        const newMetadata = { path: metadata.path, line: isNewLine ? metadata.line + 1 : ..., column: ... }
        return [ listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata: newMetadata}]
    }

export const tokenize  // :912 — the ONLY public entry point; always emits metadata
    = input => path => { ... }
```

Because the metadata layer is fused into `tokenize`, a consumer that doesn't want
positions cannot get bare tokens. This is the source of friction downstream: the
JSON tokenizer passes an empty path purely to *discard* the position info it never
wanted (`fjs/media/json/tokenizer/module.f.ts` calls `jsTokenize(input)('')`), while the
DJS tokenizer threads metadata everywhere. Both build on the same core but each
fights the single metadata-coupled entry point.

### Proposal

Separate the two concerns:

1. **Expose a raw entry point** that runs `tokenizeOp` and yields
   `List<JsToken>` without metadata (`tokenizeRaw`). JSON's tokenizer consumes this
   directly instead of supplying a dummy path and throwing positions away.
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

- [ ] export a `tokenizeRaw` (no-metadata) entry point built on `tokenizeOp`
- [ ] switch `fjs/media/json/tokenizer` to consume it instead of `jsTokenize(input)('')`
- [ ] (defer) generic `withPosition` combinator once a second consumer appears

### Related

- `fjs/js/tokenizer/module.f.ts` — pure core `tokenizeOp` (:887), position layer (:895)
- [i157](../djs/todo.md) — JSON/DJS value-layer sharing; the dummy-path
  workaround in `json/tokenizer` is downstream of this coupling
