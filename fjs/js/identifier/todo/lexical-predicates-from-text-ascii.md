## The repository's lexical predicates ask `text/ascii`

**Priority:** P3
**Status:** open

### Problem

"Is this character a digit, or a Latin letter?" is written seven times in
this repository, in six spellings, and until recently the one copy in the
module that owns the question was the only one nobody could use:

|Where|What|
|-|-|
|[`fjs/text/ascii`](../../../text/ascii/module.f.mjs)|`isDigit`, `isLatinSmallLetter`, `isLatinCapitalLetter`, `isLatinLetter`, over its own ranges — **the owner**|
|[`fjs/js/tokenizer`](../../tokenizer/module.f.mjs)|`isDigit = cp => cp >= 0x30 && cp <= 0x39`, the range as two magic numbers, in the tokenizer itself|
|[`fjs/git/config`](../../../git/config/module.f.mjs)|`isAlpha`, `isDigit`, over string comparisons|
|[`fjs/emergent_testing`](../../../emergent_testing/module.f.mjs)|`isAlpha`, `isDigit`, and `isIdentifier` and `isInteger` above them — exported from a *test* module|
|[`fjs/web`](../../../web/module.f.mjs)|`isDigits`, the digit range again|
|[`fjs/media/nix`](../../../media/nix/module.f.mjs)|the same classes built as `RangeSet`s, for Nix's identifier rule|

A character class written from literals is a class that drifts. The hole
this issue was raised over is what that costs: the FunctionalScript writer
asked `c.toLowerCase()` whether a character was a letter, so `'K'`, the
Kelvin sign, was a letter — it lowercases to `k` — and the writer emitted
`a.K`, which the tokenizer does not read back. A code-point range has no
such answer to give.

The classes now live in `fjs/text/ascii`, exported, and the writer in
[`fjs/fsc/serializer`](../../../fsc/serializer/module.f.mjs) asks them.
Every row below it still carries its own.

### Proposal

Each consumer asks `text/ascii` what a character is, and keeps only the rule
it adds. The distinction is the point: that a character is a digit is a fact
about ASCII, while `_` and `$` being identifier characters is JavaScript's
rule and `'` and `-` being them is Nix's, so the classes belong below and
the rules above. It is the hexadecimal codec's arrangement, which that
module already states as its reason for existing: no consumer rederives the
offsets for itself.

Above the classes, JavaScript's own rule wants a home of its own, which is
the module this `todo/` sits in: `fjs/js/identifier/module.f.mjs`, with

- `isIdentifier`, a word the tokenizer reads as one `id` token —
  `[A-Za-z_$][A-Za-z0-9_$]*` over the classes, not over literals;
- `isInteger`, a non-negative decimal without a leading zero,

which is where `emergent_testing`'s two exported predicates belong: they
encode JavaScript's lexical rules, not test logic, and a test module should
not be anyone's source of truth for them. The writer's `identifierKey` is
then that function plus the one thing it adds — refusing the six
[`literalWords`](../../keywords/module.f.mjs), which are token kinds of their
own and no `id`.

`fjs/ebnf/lib/js`'s `idStart`/`idChar` state the same rule a third time, as
grammar data. Whether the predicate can be derived from the grammar rule, or
the grammar rule from the predicate, is worth an answer before both are
written out again.

### Tasks

- [ ] `fjs/js/identifier/module.f.mjs`: `isIdentifier` and `isInteger` over
      `text/ascii`'s classes, with a co-located proof at 100% (the cases in
      `fjs/emergent_testing/proof.f.mjs` are the start).
- [ ] Register it in `deno.json` `exports`.
- [ ] `fjs/emergent_testing`: drop the four definitions, import the two.
- [ ] `fjs/js/tokenizer`: `isDigit` from `text/ascii`, the magic numbers gone.
- [ ] `fjs/git/config`: `isAlpha`/`isDigit` from `text/ascii`; its `isKeyChar`
      keeps the `-` it adds.
- [ ] `fjs/web`: `isDigits` over `isDigit`.
- [ ] `fjs/media/nix`: its range sets over `text/ascii`'s classes, keeping
      Nix's own identifier rule.
- [ ] `fjs/fsc/serializer`: `identifierKey` over `isIdentifier`, keeping the
      literal-word rule it adds.
- [ ] Answer the `fjs/ebnf/lib/js` question above, here or in a todo of its own.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/text/ascii/module.f.mjs`](../../../text/ascii/module.f.mjs) — the
  owner of the classes, and of the hexadecimal codec that states the reason.
- [`fjs/fsc/todo/functionalscript-output.md`](../../../fsc/todo/functionalscript-output.md)
  — the writer whose Kelvin-sign hole raised this.
