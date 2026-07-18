## add-metadata. Track path/line/column metadata in the new tokenizer

**Priority:** P3
**Status:** done

### Problem

`fs/js/tokenizer/module.f.ts` computes a `TokenMetadata` (`{path, line,
column}`) per token via `tokenizeWithPositionOp`: it walks code points with a
`stateScan`, bumping `line`/resetting `column` on `lf` and incrementing
`column` otherwise, seeded as `{path, line: 1, column: 1}`. The old DJS
tokenizer (`fs/djs/tokenizer/module.f.ts`) carries that metadata straight
through into `DjsTokenWithMetadata = {token, metadata}`, and
`fs/djs/parser/module.f.ts` depends on it pervasively — every parse error and
every `pushRef` call threads `metadata` for error reporting.

`fs/djs/tokenizer-new/module.f.ts` had no position tracking at all. Its
`descentParserCpOnly` built `CodePointMeta<T> = [CodePoint, T]` pairs via
`mapCodePoint`, but always set `T = undefined` — the metadata slot existed in
the descent parser's type (`fs/bnf/descent/module.f.ts`) but was never
populated. `tokenizeString`'s output had no `path`/`line`/`column` anywhere.

### What shipped

- `advanceMetadata`/`metadataScan`/`codePointsWithMetadata` compute
  `TokenMetadata` per code point with the same line/column logic as
  `tokenizeWithPositionOp`, reusing `fs/js/tokenizer`'s `TokenMetadata` type
  (not redefined).
- `Token` became a 3-tuple `[tag, startMetadata, codePoints]`; `FlatToken`,
  `TokenScanState`, `scanFunc`, `getTokensFromAstRule`/
  `getTokensFromAstRuleOrCodePoint`/`getTokensFromAstSequence`, and
  `toJsToken` were updated to carry `TokenMetadata` through instead of
  discarding it, so the token's *first* code point's metadata survives to
  the end.
- Rather than making this pipeline generic over an arbitrary `T` (the
  original proposal), it's concretely typed to `TokenMetadata` throughout —
  passing still-generic function values into `flatMap`/`filter` runs into
  TypeScript's unreliable higher-order generic inference, so `tokenizeString`
  (the debug/test path) now also computes real (if unused) metadata via the
  same functions rather than a separate `T = unknown` instantiation. Its
  string output is unaffected — verified by the full existing test suite.
- `descentParserCpOnly` itself was left untouched (still `T = unknown`,
  still used by `isValid`/`tokenizer` proof tests directly); the new
  `codePointsWithMetadata` helper is a separate, concretely-typed entry point
  used by both `tokenizeString` and the new `tokenize` export.
- New export: `tokenize: (input: List<number>) => (path: string) =>
  List<JsTokenWithMetadata>`, matching `fs/js/tokenizer`'s own `tokenize`
  shape (JS-level, not yet DJS-level — that wrapping is
  [replace-old-tokenizer](replace-old-tokenizer.md)'s job).
- Proof coverage in `fs/djs/tokenizer-new/proof.f.ts`'s new `metadata` block:
  column advance per character, line advance + column reset on `\n`
  (including consecutive newlines collapsing into one `nl` token while line
  still advances correctly for what follows), position resuming correctly
  after a multi-line block comment, `path` threading, and the empty-input
  and error cases below.

### Known limitation (not closed here)

Unlike the old char-by-char state machine, tokenizer-new's grammar either
parses the *whole* input as tokens or fails — it has no per-character
error-recovery path. On failure (a hard grammar failure, or the `numError`/
`unterminated` tags) `tokenize` returns a single generic `{kind: 'error',
message: 'invalid token'}` entry at the *start* of input, rather than
pinpointing the failing token or continuing to scan afterward the way the
old tokenizer's inline `{kind: 'error', ...}` tokens do. Closing this gap is
a grammar-completeness concern, not a metadata one — leaving it for whoever
picks up [replace-old-tokenizer](replace-old-tokenizer.md) next, since the
DJS parser's error-recovery expectations should drive how much of this is
actually needed.

### Tasks

- [x] Reuse `fs/js/tokenizer`'s `TokenMetadata` type (don't redefine it).
- [x] Compute per-code-point `TokenMetadata`, mirroring
      `tokenizeWithPositionOp`'s line/column `stateScan`.
- [x] Thread that metadata through `CodePointMeta<TokenMetadata>` (via the
      new `codePointsWithMetadata`, not `descentParserCpOnly` — see above).
- [x] Preserve the first code point's metadata per token through
      `getTokensFromAstRule` → `scanFunc` → `toJsToken`.
- [x] Add proof coverage asserting line/column advance across newlines,
      multi-line block comments, and multi-token lines.

### Related

- [replace-old-tokenizer](replace-old-tokenizer.md) — next step; wraps
  `tokenize` with DJS-level keyword remapping/minus-folding and swaps in
  `fs/djs/parser`/`fs/djs/transpiler`. Also owns the error-recovery gap
  noted above.
- `fs/js/tokenizer/module.f.ts` — `TokenMetadata`, `tokenizeWithPositionOp`.
- `fs/djs/parser/module.f.ts` — the consumer that needs `metadata` on every
  token for error reporting.
