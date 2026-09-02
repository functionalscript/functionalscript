## Layered Parser

**Priority:** P3
**Status:** open

Each layer is a parser acting as a **transducer**: it consumes a stream of
symbols of one alphabet and emits a stream of symbols of the next, each carrying
meta information (file name, position, the original symbols). Stacking these
transducers is another way to construct automata — composition in **series**
(pipeline), as opposed to the parallel/product combination of recognizers.

The bottom layer is a **text decoder**: it accepts a stream of **bytes** and
emits a stream of **code-points** (e.g. UTF-8 decoding). On top of it a
**tokenizer** accepts code-points and emits **tokens**, and on top of that a
parser builds the **AST**:

```
bytes ==BNF==> code-points + meta ==BNF==> tokens(symbol + meta) ==BNF==> AST
```

Each token type is represented by a single symbol, e.g. `s` for string, `n` for
number, `i` for identifier. All other information (actual value, position, etc.)
is carried as meta information.

Every layer reuses the same BNF engine.

### Transducers, recognizers, and streaming

A transducer's step is Mealy-style, which is exactly the existing
`StateScan<I, S, O>` (`fjs/types/function/operator`): `(inSymbol, state) =>
[outSymbol*, state]`, driven by `stateScan` over a `List`. A **recognizer** (see
[recognizer-backend](./recognizer-backend.md)) is the degenerate transducer that
emits nothing and only reports a verdict; so **UTF-8 validation is just the
byte→code-point decoder with its output discarded** — the same automaton the
text layer uses, projected to accept/reject.

Two mechanics the layers need:

- **Maximal munch** in the tokenizer: a DFA *recognizes*, but tokenizing must
  decide where to *cut* — emit a token at the longest accepting prefix, then
  restart. This is the one mechanism the token transducer adds over plain
  recognition.
- **Streaming survives composition**: transducers compose as streaming folds,
  so the whole `bytes → … → AST` pipeline stays incremental — what large inputs
  (big source files, streamed blobs) require.

### Open Questions

- **Keyword disambiguation**: identifiers and keywords may share the same symbol. Options: separate token type per keyword, or grammar rules that inspect meta info.

Two questions this section used to carry are answered elsewhere and are kept
here only as pointers:

- **Meta info propagation** — mostly settled by
  [generic parser metadata](./generic-parser-metadata.md), which gives the
  combining rule per rule kind: a sequence folds child metadata left to right, a
  variant preserves the selected branch's, a repetition folds its rounds. A
  layer's payload is its metadata ([207 §7](./207-bnf-semantic-actions.md)),
  and a layer *transforms* it, so the fold is `translate: (mi: MI) => MO` plus
  `reduce: Reduce<MO>` rather than one monoid — folded strictly left to right,
  `reduce` being under no obligation to be associative. What an **empty** match
  contributes is still open, since the monoid identity used to answer it and
  `reduce` has none: [43](./043-stateful-parser.md)'s.
- **Error reporting** — there is no unified error *representation* to design,
  because no layer has an error channel to unify. Each layer is a total fold
  whose failure is ordinary data in its own output type
  ([43](./043-stateful-parser.md), [`todo/flow.md`](../../../todo/flow.md)), so
  a bad token and a bad structure are values of the layer that produced them,
  carrying that layer's metadata by construction.

  **What is still open is where in the output that data goes**, and it is a
  protocol question for the pipeline rather than a matter of taste.
  [`todo/flow.md`](../../../todo/flow.md) offers two conventions: *in-band*,
  emitting `O = Result<T, Err>` so the next stage confronts failure per item, or
  *in the summary*, reporting through `A = Result<…, Err>` — and it is explicit
  that the summary form is only sound when "the final program result is
  assembled by combining the `result` flows of the stages that matter".

  A stack that mixes them silently loses failures. If a decoder reports a
  truncated encoding in its summary and the tokenizer above it reads only the
  emitted stream, the parser accepts the successfully decoded prefix and nothing
  ever reads the summary — which is exactly the silent truncation
  [43](./043-stateful-parser.md)'s end-of-input note and
  [DESIGN.md §10](../../../doc/DESIGN.md) both warn about. So this pipeline has to
  say which convention each layer uses, and where a summary is checked if any
  layer uses one.
