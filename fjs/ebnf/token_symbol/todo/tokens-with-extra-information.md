## Tokens with extra information

**Priority:** P3
**Status:** open

The token half of this shipped: an input symbol is a `Meta<I>` of
[`../../ast`](../../ast/README.md), one symbol with whatever the layer below
knew about it, and `fjs/djs/parser` reads a token stream that way — each
token's symbol from [`../module.f.mjs`](../module.f.mjs), the whole token
with its position as the metadata, a keyword's word telling it from an
identifier. What remains is the pipeline below the parser: the backend that
turns the AST into generated Rust or hands it to `Function`.

Each input token is an integer and may carry additional information:

- Position
- Source file
- Parsed value (e.g. an `id` or number token may also contain the parsed value)

### FunctionalScript pipeline

```
tokenizer(CFG) ==AST==> ToFsToken(Fun) ==Token[]==> parser(CFG) ==AST==> backend(Fun) ==generated Rust | Any==>
```

This allows a simple and fast `LL(1)` parser. **CFG** = context-free grammar, **Fun** = functional transformation.

The AST is the stable representation of functions, expressed as an FJS value (see
[`spec/todo/serialization.md`](../../../../spec/todo/serialization.md));
a backend either generates Rust code calling the `nanvm-lib` API (AOT) or hands the AST as data to
the `Function` constructor (interpretation).

Result of tokenizer and token transformation:

- primitive `value`: number, string, boolean, null, bigint, undefined
- `newLine`
- `id`
- operators: `{`, `}`, `[`, `]`, `,`, `-`
- reserved words: `const`, `export`, `default`, `import`
