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
`StateScan<I, S, O>` (`fs/types/function/operator`): `(inSymbol, state) =>
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
- **Meta info propagation**: when the upper parser reduces a sequence of tokens, how does meta info (e.g. source span) combine into the parent node?
- **Error reporting**: lower-layer errors (bad token) and upper-layer errors (bad structure) need a unified error representation that carries the right meta info.
