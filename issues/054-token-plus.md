# Tokens with Extra Information

Each input token is an integer number and may have additional information such as

- Position.
- Source file.
- Parsed information. For example, a token `id` or a number may also contain a value.

## FunctionalScript

```
tokenizer(CFG) ==AST==> ToFsToken(Fun) ==Token[]==> parser(CFG) ==AST==> ToBytCode(Fun) ==ByteCode==>
```

This way we can use a simple and fast `LL(1)` parser.

- **CFG**, context-free grammar,
- **Fun**, functional transformation.

Result of tokenizer and token transformation:

- primitive `value`:
  - number
  - string
  - boolean
  - null
  - bigint
  - undefined
- `newLine`
- `id`
- operators: `{`, `}`, `[`, `]`, `,`, `-`
- reserved words (https://www.w3schools.com/js/js_reserved.asp):
  - `const`
  - `export`
  - `default`
  - `import`
