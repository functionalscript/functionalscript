## error-message-specificity. tokenizer-new only reports one generic error, not the old tokenizer's specific ones

**Priority:** P4
**Status:** open

### Problem

The old tokenizer (`fs/djs/tokenizer`, deleted in
[replace-old-tokenizer](replace-old-tokenizer.md)) reported ~10 distinct,
specific messages depending on what went wrong — `'invalid number'`,
`'unexpected character'`, `'" are missing'`, `'unescaped character'`,
`'invalid hex value'`, `'*/ expected'`, `'invalid token'` — each at the
exact position of the failing character, and it kept tokenizing afterward,
so the parser still saw whatever valid tokens came later.

`fs/djs/tokenizer-new/module.f.ts`'s grammar (`descentParser`) has no
cut/commit mechanism — it either parses the whole input as tokens or fails
as one unit. This is why `numError`/`unterminated` exist at all (see
[add-metadata](add-metadata.md)'s "Known limitation" and
`multilineContent`'s comment in `module.f.ts`): they turn what would be a
hard grammar failure into an always-succeeding, specially-tagged match, so
the descent parser doesn't fall back to matching stray characters as
unrelated operator tokens.

As a result, `tokenizeJs`/`tokenize` in `fs/djs/tokenizer-new/module.f.ts`
collapse every failure mode — malformed numbers, unterminated strings,
unterminated comments, unrecognized characters, anything the grammar can't
fully parse — into a single `{kind: 'error', message: 'invalid token'}`,
and tokenization stops there instead of continuing. Position accuracy was
fixed in `replace-old-tokenizer.md` (via `len` and `metadataAfterTag`), but
message specificity and continuation were explicitly deferred — confirmed
with the user before that task, since closing this gap properly is a much
bigger, separate undertaking than the metadata/swap work.

This is a real DX regression for anyone editing malformed DJS source: they
now get "invalid token" wherever the file happens to become unparseable,
instead of a message that tells them what's actually wrong (missing closing
quote vs. bad number vs. bad escape, etc.), and nothing after the first
problem gets checked.

No current test depends on this (confirmed during `replace-old-tokenizer.md`
research: `fs/djs/parser/proof.f.ts` had zero tests exercising an actual
tokenizer-emitted error token), so there's no urgency — this is tracked so
it doesn't get silently forgotten, not because something is broken today.

### Proposal

Two separable improvements, either could land independently:

1. **Per-failure-type messages.** Extend the `numError`/`unterminated`-style
   tagging to distinguish *why* a token is invalid — e.g. separate tags for
   "digits expected after `.`" vs. "digits expected after `e`" vs. "disallowed
   trailing char" (the `fracPart`/`expPart`/trailing-check branches in
   `module.f.ts`'s `number` rule already structurally know which case fired;
   right now they're all folded into one `numError` tag). Do the same for
   `string` (currently a hard grammar failure, not a tagged one — would need
   the same always-succeeds-but-tagged treatment `multilineContent` uses) and
   for genuinely unrecognized characters (currently just falls through to
   `len !== cp.length`).
2. **Continue tokenizing after an error.** Requires restructuring away from
   "parse the whole input as one grammar match" toward something that can
   resume after a recognized failure point — a bigger architectural change,
   possibly re-running the tokenizer from the next plausible token boundary
   after emitting an error token. Needs its own design pass; not sketched
   here.

Start with (1) if this becomes worth doing — it's additive to the existing
tagging technique and doesn't require an architecture change. (2) is likely
not worth it unless a real use case (e.g. an editor/LSP wanting multiple
diagnostics per file) shows up.

### Tasks

- [ ] Decide if this is worth doing at all — re-check whether any consumer
      (editor tooling, error-reporting UX) actually needs it before
      investing here.
- [ ] If yes: tag specific failure reasons in the `number`/`string`/comment
      grammar rules (extending the `numError`/`unterminated` pattern).
- [ ] Update `tokenizeJs`'s error branch to surface the specific message
      instead of always `'invalid token'`.
- [ ] Separately evaluate whether continuation-after-error is actually
      needed, given `fs/djs/parser` already freezes on the first error and
      doesn't do multi-error collection today.

### Related

- [replace-old-tokenizer](replace-old-tokenizer.md) — where this was
  deferred.
- [add-metadata](add-metadata.md) — "Known limitation" section, first place
  this gap was written down.
- `fs/djs/tokenizer-new/module.f.ts` — `numError`/`unterminated` tagging,
  `tokenizeJs`'s error branch.
