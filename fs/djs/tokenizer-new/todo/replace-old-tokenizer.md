## replace-old-tokenizer. Replace `fs/djs/tokenizer` (and `fs/js/tokenizer`) with tokenizer-new

**Priority:** P3
**Status:** open

### Problem

DJS currently tokenizes through a hand-written state machine:
`fs/js/tokenizer/module.f.ts` (char-by-char range-map scanner) wrapped by
`fs/djs/tokenizer/module.f.ts` (`tokenize: (input: List<number>) => (path:
string) => List<DjsTokenWithMetadata>`), which folds a leading `-` into the
following number/bigint token.

`fs/djs/tokenizer-new/module.f.ts` is a parallel, BNF-grammar-based
implementation driven by `descentParser` (`fs/bnf/descent`). It's had solid
proof coverage built up incrementally (strings, ids, keywords, comments,
numbers, bigint — see `fs/djs/tokenizer-new/proof.f.ts`), but its only public
entry point is `tokenizeString: (s: string) => string`, a debug/test helper
that serializes the whole token list to a string (or returns the literal
`'error'`). It has no `List<DjsTokenWithMetadata>`-shaped API, and `parse`
is still `todo()`-stubbed (`fs/djs/tokenizer-new/module.f.ts`).

The old tokenizer has real consumers today:

- `fs/djs/transpiler/module.f.ts` — `tokenize(stringToList(result[1]))(path)`
  then `parseFromTokens(tokens)`.
- `fs/djs/parser/module.f.ts` — destructures `{token, metadata}` from every
  `DjsTokenWithMetadata`, switches on every `DjsToken` kind, and threads
  `metadata` into every parse error and `pushRef` call. Heavy, pervasive use.
- `fs/djs/parser/proof.f.ts` — imports `tokenize`/`DjsTokenWithMetadata`
  directly and asserts on serialized `metadata` (`path`/`line`/`column`).

`fs/djs/todo/157.md` already flags tokenizer-new as intentionally excluded
from a `tokenize`-minus-rewriter dedup pass, since it's a separate track.

### Proposal

Give tokenizer-new a real `tokenize` export matching the old signature
(`(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>`),
built on top of [add-metadata](add-metadata.md) — this is blocked on that
todo, since `DjsTokenWithMetadata` requires per-token `TokenMetadata`
(`path`/`line`/`column`) that tokenizer-new doesn't compute yet.

Once that exists:

- Swap the import in `fs/djs/transpiler/module.f.ts` and
  `fs/djs/parser/module.f.ts` from `fs/djs/tokenizer` to
  `fs/djs/tokenizer-new`.
- Update `fs/djs/parser/proof.f.ts`'s `tokenizeString` test helper.
- Delete `fs/djs/tokenizer/module.f.ts` (+ its `proof.f.ts`) once nothing
  imports it.
- Check whether `fs/js/tokenizer` still has other consumers (e.g.
  `fs/media/json/tokenizer`) before removing it — it may need to stay even
  after DJS moves off it.

### Tasks

- [ ] Land [add-metadata](add-metadata.md) so tokens carry `TokenMetadata`.
- [ ] Add a `tokenize: (input: List<number>) => (path: string) =>
      List<DjsTokenWithMetadata>` export to `fs/djs/tokenizer-new/module.f.ts`
      with the same keyword-remapping / DjsToken-narrowing behavior as the
      old `fs/djs/tokenizer`.
- [ ] Point `fs/djs/transpiler/module.f.ts` and `fs/djs/parser/module.f.ts`
      at `fs/djs/tokenizer-new`.
- [ ] Update `fs/djs/parser/proof.f.ts` and re-run its assertions (including
      the metadata-in-error-message case).
- [ ] Remove `fs/djs/tokenizer/` once unused; confirm `fs/js/tokenizer` still
      has a live consumer before touching it.
- [ ] Run `npx tsc` and `fjs t`.

### Related

- [add-metadata](add-metadata.md) — blocking prerequisite.
- `fs/djs/todo/157.md` — notes tokenizer-new as excluded from the old
  tokenizer's dedup pass.
- `fs/djs/parser/module.f.ts` — the heaviest consumer of `DjsTokenWithMetadata`.
