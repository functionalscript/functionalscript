## Layered Parser

**Priority:** P3
**Status:** open

A tokenizer accepts a sequence of code-points as input tokens together with meta information (file name, position). It uses our BNF parser to output new tokens.

Each token type is represented by a single symbol, e.g. `s` for string, `n` for number, `i` for identifier. All other information (actual value, position, etc.) is carried as meta information. This sequence of tokens is then the input into a new parser layer.

```
code-points + meta ==BNF==> tokens(symbol + meta) ==BNF==> AST
```

Both layers reuse the same BNF engine.

### Open Questions

- **Keyword disambiguation**: identifiers and keywords may share the same symbol. Options: separate token type per keyword, or grammar rules that inspect meta info.
- **Meta info propagation**: when the upper parser reduces a sequence of tokens, how does meta info (e.g. source span) combine into the parent node?
- **Error reporting**: lower-layer errors (bad token) and upper-layer errors (bad structure) need a unified error representation that carries the right meta info.
