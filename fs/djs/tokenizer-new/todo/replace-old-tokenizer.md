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
numbers, bigint — see `fs/djs/tokenizer-new/proof.f.ts`), and — since
[add-metadata](add-metadata.md) landed — a JS-level `tokenize: (input:
List<number>) => (path: string) => List<JsTokenWithMetadata>` export
matching `fs/js/tokenizer`'s own shape. It still has no DJS-level
`List<DjsTokenWithMetadata>` API (keyword remapping, minus-folding into
negative numbers), and `parse` is still `todo()`-stubbed
(`fs/djs/tokenizer-new/module.f.ts`). It also has no per-character
error-recovery: a hard grammar failure or `numError`/`unterminated` produces
a single generic `{kind: 'error', message: 'invalid token'}` entry at the
start of input rather than pinpointing the failure and continuing — see
add-metadata.md's "Known limitation."

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

Wrap tokenizer-new's JS-level `tokenize` (from
[add-metadata](add-metadata.md)) with a DJS-level `tokenize` export matching
the old signature (`(input: List<number>) => (path: string) =>
List<DjsTokenWithMetadata>`) — mirroring `fs/djs/tokenizer/module.f.ts`'s
`mapToken`/`scanToken` (keyword remapping, folding a leading `-` into the
following number/bigint token).

Then:

- Decide whether the error-recovery gap (see above) needs closing first —
  check what `fs/djs/parser/module.f.ts` actually does with inline error
  tokens vs. a single terminal error before assuming it's required.
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

- [x] Land [add-metadata](add-metadata.md) so tokens carry `TokenMetadata`.
- [ ] Add a DJS-level `tokenize: (input: List<number>) => (path: string) =>
      List<DjsTokenWithMetadata>` export to `fs/djs/tokenizer-new/module.f.ts`
      wrapping the existing JS-level `tokenize`, with the same
      keyword-remapping / DjsToken-narrowing behavior as the old
      `fs/djs/tokenizer`.
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
