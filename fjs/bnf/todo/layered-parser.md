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

- **Meta info propagation** — settled by
  [generic parser metadata](./generic-parser-metadata.md), which gives the
  combining rule per rule kind: a sequence folds child metadata left to right, a
  variant preserves the selected branch's, a repetition folds its rounds, and an
  empty match takes the monoid identity. A layer's payload is its `M`
  ([207 §7](./207-bnf-semantic-actions.md)).
- **Error reporting** — there is no unified error representation to design,
  because no layer has an error channel to unify. Each layer is a total fold
  whose failure is ordinary data in its own output type
  ([43](./043-stateful-parser.md), [`todo/flow.md`](../../../todo/flow.md)), so
  a bad token and a bad structure are values of the layer that produced them,
  carrying that layer's metadata by construction. What remains is a library
  question — whether the layers should agree on a *convention* for the shape of
  that value — not a protocol one.
