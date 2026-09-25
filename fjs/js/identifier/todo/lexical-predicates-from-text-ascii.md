## The repository's lexical predicates ask `text/ascii`

**Priority:** P3
**Status:** open

### Problem

"Is this character a digit, or a Latin letter?" is written in module after
module, in nearly as many spellings, and until recently the one copy in the
module that owns the question was the only one nobody could use:

|Where|What|
|-|-|
|[`fjs/text/ascii`](../../../text/ascii/module.f.mjs)|`isDigit`, `isLatinSmallLetter`, `isLatinCapitalLetter`, `isLatinLetter`, over its own ranges, and `isCanonicalDigits`, a decimal run without a leading zero — **the owner**|
|[`fjs/js/tokenizer`](../../tokenizer/module.f.mjs)|`isDigit = cp => cp >= 0x30 && cp <= 0x39`, the range as two magic numbers, in the tokenizer itself|
|[`fjs/git/config`](../../../git/config/module.f.mjs)|`isAlpha`, `isDigit`, over string comparisons|
|[`fjs/git/store`](../../../git/store/module.f.mjs)|`isOctal` over string comparisons, and `parseInt(…, 8)` for the value, where `fjs/git/tree` reads octal with `text/ascii`'s `digitsValue(8n)`|
|[`fjs/git/refstore`](../../../git/refstore/module.f.mjs)|`isPseudoref`, the capital letters as `'A'`..`'Z'`|
|[`fjs/git/tree`](../../../git/tree/module.f.mjs)|`lower`, the capital letters as `0x41`..`0x5A`|
|[`fjs/emergent_testing`](../../../emergent_testing/module.f.mjs)|`isAlpha`, `isDigit`, and `isIdentifier` and `isInteger` above them — exported from a *test* module|
|[`fjs/rtti/ts`](../../../rtti/ts/module.f.mjs)|`isIdStart` and `isIdPart`, JavaScript's identifier rule over string comparisons, which `isTypeName` reads|
|[`fjs/web`](../../../web/module.f.mjs)|`isDigits`, the digit range again|
|[`fjs/website/browser-source`](../../../website/browser-source/module.f.mjs)|`nameChar`, JavaScript's identifier characters over string comparisons|
|[`fjs/website/changelog`](../../../website/changelog/module.f.mjs)|`isDigit` and `isHex`, over `charCodeAt` and named constants|
|[`fjs/path`](../../../path/module.f.mjs)|`isDriveLetter`, the Latin letters over string comparisons|
|[`fjs/media/nix`](../../../media/nix/module.f.mjs)|the same classes built as `RangeSet`s, for Nix's identifier rule|
|[`fjs/media/datajs/vectors/matrix`](../../../media/datajs/vectors/matrix/module.f.mjs)|`lower`, `upper` and `digits`, the classes spelled out as string literals|

Most of these ask about a one-character *string*, where `text/ascii`'s
classes take a code point, which is part of why each consumer wrote its own.

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
- `isInteger`, a non-negative decimal without a leading zero — which is
  `text/ascii`'s `isCanonicalDigits` over the word's code points, so it adds
  nothing but the conversion,

which is where `emergent_testing`'s two exported predicates belong: they
encode JavaScript's lexical rules, not test logic, and a test module should
not be anyone's source of truth for them. The writer's `identifierKey` is
then that function and nothing else: a word that denotes a value names a
property like any other — `a.NaN` is an access — so the writer has no rule
of its own left to add. `rtti/ts`'s `isTypeName` is another consumer of
`isIdentifier`, keeping the reserved-word checks it adds.

`fjs/ebnf/lib/js`'s `idStart`/`idChar` state the same rule a third time, as
grammar data. Whether the predicate can be derived from the grammar rule, or
the grammar rule from the predicate, is worth an answer before both are
written out again.

### Tasks

- [ ] Decide whether `text/ascii` also offers the classes over a
      one-character string, which most rows above ask about, or each
      consumer converts to a code point first.
- [ ] `fjs/js/identifier/module.f.mjs`: `isIdentifier` over `text/ascii`'s
      classes and `isInteger` over `isCanonicalDigits`, with a co-located proof
      at 100% (the cases in `fjs/emergent_testing/proof.f.mjs` are the start).
      No `deno.json` `exports` entry: the file has no map today, and
      [group-fs-subdirectories-by-concern](../../../todo/group-fs-subdirectories-by-concern.md)
      reserves introducing one for the change that enumerates every module.
- [ ] `fjs/emergent_testing`: drop the four definitions, import the two.
- [ ] `fjs/js/tokenizer`: `isDigit` from `text/ascii`, the magic numbers gone.
- [ ] `fjs/git/config`: `isAlpha`/`isDigit` from `text/ascii`; its `isKeyChar`
      keeps the `-` it adds.
- [ ] `fjs/git/store`: `isOctal` from the classes, and the octal value read
      with `digitsValue(8n)` as `fjs/git/tree` does, not `parseInt`.
- [ ] `fjs/git/refstore`: `isPseudoref` over `isLatinCapitalLetter`, keeping
      the `-` and `_` it adds; `fjs/git/tree`: `lower` over the same class.
- [ ] `fjs/rtti/ts`: `isIdStart`/`isIdPart` go; `isTypeName` asks
      `isIdentifier`.
- [ ] `fjs/web`: `isDigits` over `isDigit`.
- [ ] `fjs/website/browser-source`: `nameChar` over the identifier rule;
      `fjs/website/changelog`: `isDigit` and `isHex` from `text/ascii`.
- [ ] `fjs/path`: `isDriveLetter` over `isLatinLetter`.
- [ ] `fjs/media/nix`: its range sets over `text/ascii`'s classes, keeping
      Nix's own identifier rule.
- [ ] `fjs/media/datajs/vectors/matrix`: `lower`, `upper` and `digits` over
      the classes, keeping the punctuation each allowed set adds.
- [ ] `fjs/fsc/serializer`: `identifierKey` becomes `isIdentifier`, with
      nothing added. Its proof walks every keyword and expects `.k` for each,
      so a rule creeping back in fails there.
- [ ] Answer the `fjs/ebnf/lib/js` question above, here or in a todo of its own.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/text/ascii/module.f.mjs`](../../../text/ascii/module.f.mjs) — the
  owner of the classes, and of the hexadecimal codec that states the reason.
- [`fjs/fsc/serializer`](../../../fsc/serializer/module.f.mjs) — the writer
  whose Kelvin-sign hole raised this.
