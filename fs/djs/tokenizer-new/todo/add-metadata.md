## add-metadata. Track path/line/column metadata in the new tokenizer

**Priority:** P3
**Status:** open

### Problem

`fs/js/tokenizer/module.f.ts` computes a `TokenMetadata` (`{path, line,
column}`) per token via `tokenizeWithPositionOp`: it walks code points with a
`stateScan`, bumping `line`/resetting `column` on `lf` and incrementing
`column` otherwise, seeded as `{path, line: 1, column: 1}`. The old DJS
tokenizer (`fs/djs/tokenizer/module.f.ts`) carries that metadata straight
through into `DjsTokenWithMetadata = {token, metadata}`, and
`fs/djs/parser/module.f.ts` depends on it pervasively — every parse error and
every `pushRef` call threads `metadata` for error reporting.

`fs/djs/tokenizer-new/module.f.ts` has no position tracking at all. Its
`descentParserCpOnly` builds `CodePointMeta<T> = [CodePoint, T]` pairs via
`mapCodePoint`, but always sets `T = undefined` — the metadata slot exists in
the descent parser's type (`fs/bnf/descent/module.f.ts`) but is never
populated. `tokenizeString`'s output has no `path`/`line`/`column` anywhere.

### Proposal

Populate the existing `CodePointMeta<T>` slot instead of bolting on a
separate pass:

- Replace `mapCodePoint : (cp: CodePoint) => CodePointMeta<unknown>` with a
  version parameterized on `T = TokenMetadata`, computed with the same
  line/column `stateScan` logic as `tokenizeWithPositionOp` (reuse
  `fs/js/tokenizer`'s `TokenMetadata` type rather than redefining it).
- `descentParser<T>`/`AstRuleMeta<T>` are already generic — the AST nodes and
  the code points inside `ast.sequence` will carry `[CodePoint, TokenMetadata]`
  once `descentParserCpOnly` is called with real per-code-point metadata
  instead of `undefined`.
- `getTokensFromAstRule`/`getTokensFromAstRuleOrCodePoint` currently discard
  the metadata half of each `CodePointMeta` (`value[0]` only, see
  `fs/djs/tokenizer-new/module.f.ts`). They need a metadata-preserving path so
  the *first* code point's metadata of each emitted `Token` survives through
  to `toJsToken`/`toJsTokens`.
- Extend the internal `Token` shape (currently `[string, readonly number[]]`)
  to also carry that starting metadata, and have `toJsToken` attach it to the
  final `JsToken`, producing something shaped like `JsTokenWithMetadata`.

### Tasks

- [ ] Reuse `fs/js/tokenizer`'s `TokenMetadata` type (don't redefine it).
- [ ] Compute per-code-point `TokenMetadata` alongside `stringToCodePointList`
      output, mirroring `tokenizeWithPositionOp`'s line/column `stateScan`.
- [ ] Thread that metadata through `CodePointMeta<T>` in
      `descentParserCpOnly` instead of `undefined`.
- [ ] Preserve the first code point's metadata per token through
      `getTokensFromAstRule` → `scanFunc` → `toJsToken`/`toJsTokens`.
- [ ] Add proof coverage asserting line/column advance across newlines,
      multi-line block comments, and multi-token lines matches the old
      tokenizer's behavior.

### Related

- [replace-old-tokenizer](replace-old-tokenizer.md) — blocked on this todo.
- `fs/js/tokenizer/module.f.ts` — `TokenMetadata`, `tokenizeWithPositionOp`.
- `fs/djs/parser/module.f.ts` — the consumer that needs `metadata` on every
  token for error reporting.
