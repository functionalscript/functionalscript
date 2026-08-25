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
|`:418-468`|`keywordEntries`|`:262`|
|`:479-535`|`operatorEntries`|`:276`|
|`:912`|`tokenize`|`:712`|

One citation names something that no longer exists at all:
[666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md) cites a
`tokenizeOp` at `:749-750` and `:750`, and `tokenizeOp` appears nowhere in
`fjs/js/`. Whatever that layer is called now, the issue's premise needs
re-reading against the current module before its citations can be repaired.

Affected files, all in `fjs/js/todo/`:

- [tokenizer-continue-string-comment](./tokenizer-continue-string-comment.md)
- [tokenizer-flush-redispatch](./tokenizer-flush-redispatch.md)
- [tokenizer-finish-number-shared](./tokenizer-finish-number-shared.md)
- [tokenizer-token-tables](./tokenizer-token-tables.md)
- [666-js-tokenizer-position-layer](./666-js-tokenizer-position-layer.md)

### Why this is not just tidiness

Each of these issues argues from a *duplication count* — "written four times",
"both arms", "repeats every one of 45 keyword kinds". A reader who follows a
citation into open space cannot check the count, so the argument has to be
re-derived from scratch before any of them can be acted on. That is the cost
this issue removes.

### Proposal

Repair each citation against the symbol it names, which is what makes this
mechanical: every table row above was found by grepping the symbol, not by
guessing an offset. Where a citation points *inside* a function rather than at
its definition (`parseStringStateOp` default arm, `terminalToToken` both arms),
read the current body and cite the line the prose actually means.

`666-js-tokenizer-position-layer` needs more than a line fix, since its subject
symbol is gone; treat it separately.

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

- [ ] Repair the citations in the four `tokenizer-*` issues against the symbols
      they name.
- [ ] Re-read `666-js-tokenizer-position-layer` against the current module and
      decide what `tokenizeOp` became before repairing its citations.
- [ ] Confirm no remaining citation in `fjs/js/todo/` exceeds the length of the
      file it names.

### Related

- `fjs/js/tokenizer/module.f.mjs` — the module the citations point into.
- [`todo/README.md`](../../../todo/README.md) — issue format; this is the
  citation half of "reference things with an explicit link".
