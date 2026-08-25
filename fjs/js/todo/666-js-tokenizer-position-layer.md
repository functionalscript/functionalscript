## 666-js-tokenizer-position-layer. Separate position/metadata tracking from the JS tokenizer core

**Priority:** P4
**Status:** open

### Problem

> **Citations drifted (2026-08).** The module is 745 lines; the numbers below
> came from a longer version of it. The two that could be re-derived are
> corrected in place. The first cannot: no `tokenizeOp` exists in `fjs/js/`
> under any line, and the pure core this issue is built on may have been
> absorbed into the position layer — which would change the issue's premise,
> not just its numbers. Re-read the module before acting on it; see
> [tokenizer-line-citations](./tokenizer-line-citations.md).

`fjs/js/tokenizer/module.f.mjs` already factors its character-to-token state machine
cleanly into a pure core that produces bare tokens:

```ts
// fjs/js/tokenizer/module.f.mjs — `tokenizeOp` no longer exists; see the note above
const tokenizeOp
    : StateScan<CharCodeOrEof, TokenizerState, List<JsToken>>
    = (input, state) => input === null ? tokenizeEofOp(state) : tokenizeCharCodeOp(input, state)
```

But the **line/column/path metadata** concern is interleaved on top of that core
and hard-wired into the only public entry point:

```ts
// fjs/js/tokenizer/module.f.mjs:697
const tokenizeWithPositionOp
    : StateScan<CharCodeOrEof, TokenizerStateWithMetadata, List<JsTokenWithMetadata>>
    = (input, {state, metadata}) => {
        ...
        const isNewLine = input == lf
        const newMetadata = { path: metadata.path, line: isNewLine ? metadata.line + 1 : ..., column: ... }
        return [ listMap(mapTokenWithMetadata(metadata))(newState[0]), { state: newState[1], metadata: newMetadata}]
    }

export const tokenize  // :712 — the ONLY public entry point; always emits metadata
    = input => path => { ... }
```

Because the metadata layer is fused into `tokenize`, a consumer that doesn't want
positions cannot get bare tokens. This is the source of friction downstream: the
JSON tokenizer passes an empty path purely to *discard* the position info it never
wanted (`fjs/media/json/tokenizer/module.f.mjs` calls `jsTokenize(input)('')`), while the
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

- `fjs/js/tokenizer/module.f.mjs` — position layer `tokenizeWithPositionOp` (:697),
  public entry `tokenize` (:712); the pure core this issue names as `tokenizeOp`
  is not in the module under that name (see the note at the top)
- [i157](../../djs/todo/157.md) — JSON/DJS value-layer sharing; the dummy-path
  workaround in `json/tokenizer` is downstream of this coupling
