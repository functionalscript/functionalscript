## tokenizer-line-citations. `js/tokenizer` citations point past the end of the file

**Priority:** P4
**Status:** open

### Problem

`fjs/js/tokenizer/module.f.mjs` is 745 lines. Five issues in this directory cite
it at line numbers between `:750` and `:912`, and many of the in-range citations
have drifted too — the module shrank and its citations never followed.

The drift is large and consistent, so these are not off-by-a-few:

|Cited as|Symbol|Actually at|
|-|-|-|
|`:703`|`parseStringStateOp`|`:489`|
|`:720`|`parseEscapeCharStateOp`|`:505`|
|`:791`|`parseSinglelineCommentStateOp`|`:568`|
|`:797`|`parseMultilineCommentStateOp`|`:575`|
|`:559`|`invalidNumberToToken`|`:356`|
|`:635`|`terminalToToken`|`:425`|
|`:655`|`bigintToToken`|`:444`|
|`:685`|`invalidNumberStateOp`|`:472`|
|`:702`|`parseEscapeDefault`|`:499`|
|`:721`|`parseUnicodeCharDefault`|`:516`|
|`:750`|`parseIdDefault`|`:541`|
|`:764`|`parseOperatorStateOp`|`:553`|
|`:807`|`parseWhitespaceDefault`|`:618`|
|`:821`|`parseNewLineDefault`|`:630`|
|`:860-886`|`tokenizeEofOp`|`:667`|
|`:418-468`|`keywordEntries`|`:262` — but see below|
|`:479-535`|`operatorEntries`|`:276`|
|`:912`|`tokenize`|`:712`|

### One of the five needs more than a new number

**`tokenizer-token-tables` has half shipped.** Its §1 says `KeywordToken`
"spells out 45 keyword kinds" and `keywordEntries` "repeats every one of them"
as `['catch', { kind: 'catch' }]` rows. Neither is true now: `_KeywordToken`
(`fjs/js/tokenizer/types.ts:69`) is
`{ kind: Exclude<typeof keywords[number], 'true'|'false'|'null'|'undefined'> }`,
derived from the shared `fjs/js/keywords` list, and `keywordEntries`
(`module.f.mjs:262`) is `keywords.map(kind => [kind, ({ kind })])`. That is the
remedy the issue proposes, already applied. Its §2 still stands — `_OperatorToken`
(`types.ts:79`) is a spelled-out union and `operatorEntries`
(`module.f.mjs:276-332`) is a literal table of ~56 `['&&=', { kind: '&&=' }]`
rows — so the issue is half done, not done. Renumbering it would leave an
implementer redoing the keyword half and working from its now-wrong ~130-line
estimate. Both type names also gained a `_` prefix.

**`666-js-tokenizer-position-layer` was written against a symbol that is gone,
and is repaired.** All three of its citations are fixed —
`tokenizeWithPositionOp` at `:697`, `tokenize` at `:712` — and the third turned
out to be answerable rather than open: `tokenizeOp` is absent because its
dispatch was **inlined** into `tokenizeWithPositionOp`, whose `:698-703` are
that operator's two branches verbatim (`input == null` → `tokenizeEofOp`,
otherwise → `tokenizeCharCodeOp`). That inverts the issue's premise — it opens
by saying the module *already* factors cleanly — without weakening its point,
so the issue now argues from the fusion and adds re-extracting the dispatch as
its first task. Nothing outstanding there.

Affected files, all in `fjs/js/todo/`:

- [tokenizer-continue-string-comment](./tokenizer-continue-string-comment.md)
- [tokenizer-flush-redispatch](./tokenizer-flush-redispatch.md)
- [tokenizer-finish-number-shared](./tokenizer-finish-number-shared.md)
- [tokenizer-token-tables](./tokenizer-token-tables.md)
- [666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md)

### Why this is not just tidiness

Each of these issues argues from a *duplication count* — "written four times",
"both arms", "repeats them all as `['&&=', { kind: '&&=' }]` rows". A reader
who follows a citation into open space cannot check the count, so the argument
has to be re-derived from scratch before any of them can be acted on. That is
the cost this issue removes — and, as the keyword half above shows, a count
that cannot be checked is a count that can quietly stop being true.

### Proposal

Repair each citation against the symbol it names, which is what makes this
mechanical: every table row above was found by grepping the symbol, not by
guessing an offset. Where a citation points *inside* a function rather than at
its definition (`parseStringStateOp` default arm, `terminalToToken` both arms),
read the current body and cite the line the prose actually means.

`tokenizer-token-tables` needs more than a line fix and should be treated
separately: rewrite it around the operator half that remains.

### The wider blind spot

Most of these are written path-less — `(:703)`, `` `:479-535` `` — so a sweep
that resolves `path:line` citations does not see them, which is why they
survived the repair in
[#1692](https://github.com/functionalscript/functionalscript/pull/1692). That
sweep counted 252 surviving bare ranges across the tree. This issue covers only
the `js/tokenizer` cluster, where the drift is corroborated by the path-ful
citations in the same files. Whether the other bare ranges are worth a tree-wide
pass — and whether citing line numbers at all is worth its maintenance cost
against naming the symbol — is a separate question.

### Tasks

- [ ] Repair the citations in `tokenizer-continue-string-comment`,
      `tokenizer-flush-redispatch` and `tokenizer-finish-number-shared` against
      the symbols they name.
- [ ] Rewrite `tokenizer-token-tables` around its operator half; the keyword
      half has shipped, so its §1, its `~130 lines` estimate and its two type
      names all need redoing rather than renumbering.
- [ ] Confirm no remaining citation in `fjs/js/todo/` exceeds the length of the
      file it names.

### Related

- `fjs/js/tokenizer/module.f.mjs` — the module the citations point into.
- [`todo/README.md`](../../../todo/README.md) — issue format; this is the
  citation half of "reference things with an explicit link".
