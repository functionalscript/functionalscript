## The repository's lexical predicates ask `text/ascii`

**Priority:** P3
**Status:** wip

### Problem

"Is this character a digit, or a Latin letter?" is written in module after
module, in nearly as many spellings, and until recently the one copy in the
module that owns the question was the only one nobody could use. The rows
still carrying their own:

|Where|What|
|-|-|
|[`fjs/text/ascii`](../../../text/ascii/module.f.js)|`isDigit`, `isLatinSmallLetter`, `isLatinCapitalLetter`, `isLatinLetter`, over its own ranges; `charIs`, any of them asked of a one-character string; `isDigits`, a string of decimal digits; and `isCanonicalDigits`, a decimal run without a leading zero — **the owner**|
|[`fjs/git/refstore/scope`](../../../git/refstore/scope/module.f.js)|`isPseudoref`, the capital letters as `'A'`..`'Z'` — a `.f.js`, which can import only what `fjs compile` accepts, as it accepts `text/ascii` now|
|[`fjs/media/datajs/vectors/matrix`](../../../media/datajs/vectors/matrix/module.f.mjs)|`lower`, `upper` and `digits`, the classes spelled out as string literals|

Most of these ask about a one-character *string*, where `text/ascii`'s
classes take a code point, which is part of why each consumer wrote its own;
`charIs` now asks a class of such a string, so no consumer converts or
measures length for itself. `fjs/git/config`, `fjs/path`, `fjs/web`,
`fjs/effects/node` and `fjs/website/changelog` ask it already, and
`fjs/git/tree`, which reads bytes, asks `isLatinCapitalLetter` directly.

A character class written from literals is a class that drifts. The hole
this issue was raised over is what that costs: the FunctionalScript writer
asked `c.toLowerCase()` whether a character was a letter, so `'K'`, the
Kelvin sign, was a letter — it lowercases to `k` — and the writer emitted
`a.K`, which the tokenizer does not read back. A code-point range has no
such answer to give.

The classes now live in `fjs/text/ascii`, exported, and JavaScript's rule
over them in [`fjs/js/identifier`](../module.f.mjs), which the writer in
[`fjs/compiler/serializer`](../../../compiler/serializer/module.f.mjs), the
tokenizer and `fjs/emergent_testing` ask.

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

- [x] Decide whether `text/ascii` also offers the classes over a
      one-character string, which most rows above ask about, or each
      consumer converts to a code point first: it does, as `charIs`.
- [x] `fjs/js/identifier/module.f.mjs`: `isIdentifier` over `text/ascii`'s
      classes and `isInteger` over `isCanonicalDigits`, with a co-located proof
      at 100% (the cases in `fjs/emergent_testing/proof.f.mjs` are the start).
      No `deno.json` `exports` entry: the file has no map today, and
      [group-fjs-subdirectories-by-concern](../../../todo/group-fjs-subdirectories-by-concern.md)
      reserves introducing one for the change that enumerates every module.
- [x] `fjs/emergent_testing`: drop the four definitions, import the two.
- [x] `fjs/js/tokenizer`: `isDigit` from `text/ascii`, the magic numbers gone.
- [x] `fjs/git/config`: `isAlpha`/`isDigit` from `text/ascii`; its `isKeyChar`
      keeps the `-` it adds.
- [x] `fjs/git/alternates`: the octal value read with `digitsValue(8n)` as
      `fjs/git/tree` does, not `parseInt`; it refuses a digit outside the
      radix itself, so `isOctal` went rather than moved.
- [ ] `fjs/git/refstore/scope`: `isPseudoref` over `isLatinCapitalLetter`, keeping
      the `-` and `_` it adds.
- [x] `fjs/git/tree`: `lower` over the same class.
- [x] `fjs/rtti/ts`: `isIdStart`/`isIdPart` go; `isTypeName` asks
      `isIdentifier`.
- [x] `fjs/web` and `fjs/effects/node`: one `isDigits` over `isDigit`, in
      `text/ascii`.
- [x] `fjs/website/browser-source`: `nameChar` over the identifier rule,
      `isIdentifierPart`, which `isIdentifier` reads too.
- [x] `fjs/website/changelog`: `isDigit` and `isHex` from `text/ascii`.
- [x] `fjs/path`: `isDriveLetter` over `isLatinLetter`.
- [x] `fjs/media/nix`: its range sets over `text/ascii`'s classes, keeping
      Nix's own identifier rule.
- [ ] `fjs/media/datajs/vectors/matrix`: `lower`, `upper` and `digits` over
      the classes, keeping the punctuation each allowed set adds.
- [x] `fjs/compiler/serializer`: `identifierKey` becomes `isIdentifier`, with
      nothing added. Its proof walks every keyword and expects `.k` for each,
      so a rule creeping back in fails there.
- [ ] Answer the `fjs/ebnf/lib/js` question above, here or in a todo of its own.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`fjs/text/ascii/module.f.js`](../../../text/ascii/module.f.js) — the
  owner of the classes, and of the hexadecimal codec that states the reason.
- [`fjs/compiler/serializer`](../../../compiler/serializer/module.f.mjs) — the writer
  whose Kelvin-sign hole raised this.
