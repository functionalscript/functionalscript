## Tokens with extra information

**Priority:** P3
**Status:** open

Each input token is an integer and may carry additional information:

- Position
- Source file
- Parsed value (e.g. an `id` or number token may also contain the parsed value)

### FunctionalScript pipeline

```
tokenizer(CFG) ==AST==> ToFsToken(Fun) ==Token[]==> parser(CFG) ==AST==> serializer(Fun) ==serialized AST==>
```

This allows a simple and fast `LL(1)` parser. **CFG** = context-free grammar, **Fun** = functional transformation.

The AST is the stable serializable representation of functions (see
[`todo/lang/README.md` §9](../../../todo/lang/README.md#9-serialization-ast-not-bytecode)); a VM
may transform it into internal bytecode on loading.

Result of tokenizer and token transformation:

- primitive `value`: number, string, boolean, null, bigint, undefined
- `newLine`
- `id`
- operators: `{`, `}`, `[`, `]`, `,`, `-`
- reserved words: `const`, `export`, `default`, `import`
