## replace-old-tokenizer. Replace `fs/djs/tokenizer` (and `fs/js/tokenizer`) with tokenizer-new

**Priority:** P3
**Status:** done

### Problem

DJS used to tokenize through a hand-written state machine:
`fs/js/tokenizer/module.f.ts` (char-by-char range-map scanner) wrapped by
`fs/djs/tokenizer/module.f.ts` (`tokenize: (input: List<number>) => (path:
string) => List<DjsTokenWithMetadata>`), which folded a leading `-` into the
following number/bigint token.

`fs/djs/tokenizer-new/module.f.ts` is a parallel, BNF-grammar-based
implementation driven by `descentParser` (`fs/bnf/descent`), with proof
coverage built up incrementally (strings, ids, keywords, comments, numbers,
bigint, metadata — see `fs/djs/tokenizer-new/proof.f.ts`).

The old tokenizer had 3 real consumers: `fs/djs/transpiler/module.f.ts`,
`fs/djs/parser/module.f.ts`, `fs/djs/parser/proof.f.ts`.

`fs/djs/todo/157.md` already flagged tokenizer-new as intentionally excluded
from a `tokenize`-minus-rewriter dedup pass, since it was a separate track.

### What shipped

- Renamed tokenizer-new's JS-level `tokenize` to `tokenizeJs`, freeing up
  `tokenize` for a new DJS-level export with the old signature
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
- Swapped the three consumer imports to `fs/djs/tokenizer-new/module.f.ts`
  and deleted `fs/djs/tokenizer/` (`module.f.ts` + `proof.f.ts`) — confirmed
  zero other importers first. `fs/js/tokenizer` was untouched (still used
  by `fs/media/json/tokenizer`).
- Found and fixed one real behavioral difference along the way: the old
  tokenizer's per-token metadata was *lagging by one token* — a token's
  reported position was actually where the *next* token started, an
  artifact of when its state machine flushed a completed token. tokenizer-new's
  metadata is start-anchored (a token's own position), which is more
  intuitive/correct. `fs/djs/parser/proof.f.ts`'s `errorMetadata[0]` test
  was calibrated to the old lagging value (`column:18`) and got updated to
  the new correct one (`column:17`, the actual `,` that failed to parse).
- Added a `djsTokenize` proof block in `fs/djs/tokenizer-new/proof.f.ts`
  covering what's DJS-specific and wasn't already covered at the JS level:
  keyword remap, minus-folding (`-10`, `-0`, negative bigint, `--`/`---`,
  dangling `-`), and position accuracy flowing through the DJS wrapper.

### Deferred

Message-specificity was intentionally not pursued (decided with the user
before implementing): the old tokenizer reports ~10 distinct messages
("invalid number", "unexpected character", `"` are missing", etc.) and
keeps tokenizing after an error so the parser can still see later valid
tokens; tokenizer-new's grammar has no cut/commit mechanism to support
per-error-type tagging or continuation cleanly (this was the whole reason
`add-metadata.md` needed the `numError`/`unterminated` tagging trick in the
first place). tokenizer-new now reports the *position* of a failure
accurately but always with the message `'invalid token'`, and stops
tokenizing there rather than continuing. Closing this gap — if it turns out
to matter in practice for DJS error messages — is its own follow-up, not
filed as a separate todo yet since `fs/djs/parser/proof.f.ts` has zero tests
today that exercise an actual tokenizer-emitted error token (confirmed via
research before this task), so there's no concrete pressure for it yet.

`parse` in `fs/djs/tokenizer-new/module.f.ts` is still `todo()`-stubbed —
unrelated to tokenization, out of scope here.

### Tasks

- [x] Land [add-metadata](add-metadata.md) so tokens carry `TokenMetadata`.
- [x] Add a DJS-level `tokenize` export to `fs/djs/tokenizer-new/module.f.ts`
      wrapping `tokenizeJs`, with the same keyword-remapping /
      DjsToken-narrowing behavior as the old `fs/djs/tokenizer`.
- [x] Point `fs/djs/transpiler/module.f.ts` and `fs/djs/parser/module.f.ts`
      at `fs/djs/tokenizer-new`.
- [x] Update `fs/djs/parser/proof.f.ts` and re-run its assertions (including
      the metadata-in-error-message case — required a genuine fix, see above).
- [x] Remove `fs/djs/tokenizer/`; confirmed `fs/js/tokenizer` still has a
      live consumer (`fs/media/json/tokenizer`) before leaving it alone.
- [x] Run `npx tsc` and `fjs t` — clean, 2105 passing.

### Related

- [add-metadata](add-metadata.md) — prerequisite, landed first.
- [error-message-specificity](error-message-specificity.md) — the deferred
  message-specificity/continuation gap, split out into its own todo.
- `fs/djs/todo/157.md` — notes tokenizer-new as excluded from the old
  tokenizer's dedup pass.
- `fs/djs/parser/module.f.ts` — the heaviest consumer of `DjsTokenWithMetadata`.
