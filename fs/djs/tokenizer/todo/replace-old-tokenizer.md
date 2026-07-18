## replace-old-tokenizer. Replace the old state-machine DJS tokenizer with the grammar-based one

**Priority:** P3
**Status:** done

### Problem

DJS used to tokenize through a hand-written state machine:
`fs/js/tokenizer/module.f.ts` (char-by-char range-map scanner) wrapped by
`fs/djs/tokenizer/module.f.ts` (`tokenize: (input: List<number>) => (path:
string) => List<DjsTokenWithMetadata>`), which folded a leading `-` into the
following number/bigint token.

A parallel, BNF-grammar-based implementation (`descentParser`,
`fs/bnf/descent`) was developed alongside it under a temporary
`fs/djs/tokenizer-new/` directory, with proof coverage built up
incrementally (strings, ids, keywords, comments, numbers, bigint, metadata —
see `fs/djs/tokenizer/proof.f.ts`). This task replaced the old one with it,
then the directory was renamed from `tokenizer-new` back to `tokenizer`
(see the [rename](#rename) note below) now that there's only one.

The old tokenizer had 3 real consumers: `fs/djs/transpiler/module.f.ts`,
`fs/djs/parser/module.f.ts`, `fs/djs/parser/proof.f.ts`.

`fs/djs/todo/157.md` already flagged the grammar-based tokenizer as
intentionally excluded from a `tokenize`-minus-rewriter dedup pass, since it
was a separate track.

### What shipped

- Renamed the grammar-based tokenizer's JS-level `tokenize` to `tokenizeJs`,
  freeing up `tokenize` for a new DJS-level export with the old signature
  (`(input: List<number>) => (path: string) => List<DjsTokenWithMetadata>`),
  ported near-verbatim from the old `mapToken`/`parseDefaultState`/
  `parseMinusState`/`scanToken` (keyword remapping via `isKeywordToken`,
  `-`-folding into negative numbers/bigints).
- Improved `tokenizeJs`'s error position: it used to always report
  `{line:1, column:1}` regardless of where the problem was. It now uses the
  descent match's `len` (how far parsing got) for a partial-match failure,
  and a new `metadataAfterTag` helper (finds the next code point after a
  `numError`/`unterminated` tag in the flattened AST) for the structural
  cases. Message text stays a single generic `'invalid token'` — see
  "Deferred" below.
- Swapped the three consumer imports over and deleted the old
  `fs/djs/tokenizer/module.f.ts` + `proof.f.ts` — confirmed zero other
  importers first. `fs/js/tokenizer` was untouched (still used by
  `fs/media/json/tokenizer`).
- Found and fixed one real behavioral difference along the way: the old
  tokenizer's per-token metadata was *lagging by one token* — a token's
  reported position was actually where the *next* token started, an
  artifact of when its state machine flushed a completed token. The new
  tokenizer's metadata is start-anchored (a token's own position), which is
  more intuitive/correct. `fs/djs/parser/proof.f.ts`'s `errorMetadata[0]`
  test was calibrated to the old lagging value (`column:18`) and got
  updated to the new correct one (`column:17`, the actual `,` that failed
  to parse).
- Added a `djsTokenize` proof block covering what's DJS-specific and wasn't
  already covered at the JS level: keyword remap, minus-folding (`-10`,
  `-0`, negative bigint, `--`/`---`, dangling `-`), and position accuracy
  flowing through the DJS wrapper.

### Rename

Once the old `fs/djs/tokenizer/` was deleted, the `fs/djs/tokenizer-new/`
directory (including this `todo/` folder) was renamed to `fs/djs/tokenizer/`
— there's no longer an "old" one to disambiguate against. All import paths
and doc references were updated accordingly.

### Deferred

Message-specificity was intentionally not pursued (decided with the user
before implementing): the old tokenizer reported ~10 distinct messages
("invalid number", "unexpected character", `"` are missing", etc.) and kept
tokenizing after an error so the parser could still see later valid tokens;
the new tokenizer's grammar has no cut/commit mechanism to support
per-error-type tagging or continuation cleanly (this was the whole reason
`add-metadata.md` needed the `numError`/`unterminated` tagging trick in the
first place). It now reports the *position* of a failure accurately but
always with the message `'invalid token'`, and stops tokenizing there
rather than continuing. Tracked separately in
[error-message-specificity](error-message-specificity.md).

`parse` in `fs/djs/tokenizer/module.f.ts` is still `todo()`-stubbed —
unrelated to tokenization, out of scope here.

### Tasks

- [x] Land [add-metadata](add-metadata.md) so tokens carry `TokenMetadata`.
- [x] Add a DJS-level `tokenize` export wrapping `tokenizeJs`, with the same
      keyword-remapping / DjsToken-narrowing behavior as the old tokenizer.
- [x] Point `fs/djs/transpiler/module.f.ts` and `fs/djs/parser/module.f.ts`
      at the grammar-based tokenizer.
- [x] Update `fs/djs/parser/proof.f.ts` and re-run its assertions (including
      the metadata-in-error-message case — required a genuine fix, see above).
- [x] Remove the old `fs/djs/tokenizer/`; confirmed `fs/js/tokenizer` still
      has a live consumer (`fs/media/json/tokenizer`) before leaving it alone.
- [x] Rename `fs/djs/tokenizer-new/` to `fs/djs/tokenizer/` once the old one
      was gone.
- [x] Run `npx tsc` and `fjs t` — clean, 2105 passing.

### Related

- [add-metadata](add-metadata.md) — prerequisite, landed first.
- [error-message-specificity](error-message-specificity.md) — the deferred
  message-specificity/continuation gap, split out into its own todo.
- [stack-recursive-tokenization](stack-recursive-tokenization.md) — this
  swap turned a latent recursion-depth limitation in the shared descent
  parser into a live crash for normal-size files (P1, found via PR review
  after this task shipped).
- [vocabulary-single-source](vocabulary-single-source.md) — a related PR
  review finding (grammar/`operatorTags` drift for `<<<`/`<<<=`).
- `fs/djs/todo/157.md` — notes this tokenizer as excluded from the old
  one's dedup pass.
- `fs/djs/parser/module.f.ts` — the heaviest consumer of `DjsTokenWithMetadata`.
