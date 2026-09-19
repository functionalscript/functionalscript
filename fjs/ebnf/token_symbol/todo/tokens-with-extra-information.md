## Tokens with extra information

**Priority:** P3
**Status:** open

The token half of this shipped: an input symbol is a `Meta<I>` of
[`../../ast`](../../ast/README.md), one symbol with whatever the layer below
knew about it, and `fjs/fsc/parser` reads a token stream that way — each
token's symbol from [`../module.f.mjs`](../module.f.mjs), the whole token
with its position as the metadata, a keyword's word telling it from an
identifier. Remaining metadata propagation follows the checked compiler
pipeline below; the token representation does not make parser output executable.

Each input token is an integer and may carry additional information:

- Position
- Source file
- Parsed value (e.g. an `id` or number token may also contain the parsed value)

### FunctionalScript pipeline

```text
layered tokenizer → tokens with metadata → JavaScript-subset AST
    → checked AST-to-EDAG compilation → Unresolved { imports, edag }
    → host resolution and linking → linked EDAG
    → interpretation, native compilation, or serialization as data
```

The layered LL(1) machinery is unchanged. **P1 correction:** the former
AST-as-function/backend route is superseded by
[statement-aware compilation](../../../fsc/parser/todo/statement-aware-intrinsics.md).
The source AST preserves statement/expression structure; bindings, visibility,
early errors, complete instruction patterns and FJS admission are checked while
compiling it to EDAG. Line-terminator information reaches statement recognition;
the instruction matcher never reparses tokens or repairs statement boundaries.

[Module compilation and linking](../../../fsc/todo/compile-modules-to-edag.md)
owns the temporary wrapper and resolved identities. The stable function-code
representation is EDAG, not a grammar tree. A public `Function` input requires
EDAG validation; AOT backends consume the admitted graph, not unchecked syntax.
The [parser structure plan](../../todo/parser-structure.md) separates these
responsibilities without renaming generic grammar ASTs.

[Serialization](../../../../spec/todo/serialization.md) owns EDAG-as-data encoding
and the open relationship between callable serialization and `String(f)`. This
metadata task does not decide frame inclusion or `self` rendering. Preserve source
metadata separately from semantic EDAG through the
[source-map work](../../../fsc/todo/investigate-edag-source-maps.md).

Result of tokenizer and token transformation:

- primitive `value`: number, string, boolean, null, bigint, undefined
- `newLine`
- `id`
- operators: `{`, `}`, `[`, `]`, `,`, `-`
- reserved words: `const`, `export`, `default`, `import`
