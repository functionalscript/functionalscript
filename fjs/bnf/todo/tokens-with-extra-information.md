## Tokens with extra information

**Priority:** P3
**Status:** open

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
[`todo/lang/README.md` §9](../../../todo/lang/README.md#9-serialization-ast-as-data-not-bytecode));
a backend either generates Rust code calling the `nanvm-lib` API (AOT) or hands the AST as data to
the `Function` constructor (interpretation).

Result of tokenizer and token transformation:

- primitive `value`: number, string, boolean, null, bigint, undefined
- `newLine`
- `id`
- operators: `{`, `}`, `[`, `]`, `,`, `-`
- reserved words: `const`, `export`, `default`, `import`
