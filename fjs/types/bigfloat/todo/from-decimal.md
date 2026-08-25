## Own decimal literal → `BigFloat`

**Priority:** P3
**Status:** open

### Problem

Both tokenizers convert a decimal number literal into the same
`BigFloat = readonly [mantissa: bigint, exp: number]`, by different
algorithms, and neither lives in this module:

- `fjs/js/tokenizer/module.f.mjs:267-286` — incremental accumulator threaded
  through the scan state (`addFracDigit`, `addExpDigit`,
  `bufferToNumberToken` computing `[b.s * b.m, b.f + b.es * b.e]`);
- `fjs/djs/tokenizer/module.f.mjs:378-390` — `decodeNumber` doing string
  surgery over the matched lexeme (`BigInt(intDigits + fracDigits)`,
  `exp - fracDigits.length`).

`fjs/types/bigfloat` exports arithmetic and the decimal→binary rounding
(`multiply`, `decToBin`, `tryDecToFormat`) but nothing that *builds* a
`BigFloat` from digits, so the conversion has no owner and both lexers grew
their own. The exponent/fraction
sign bookkeeping is exactly the kind of arithmetic that should be stated
once.

### Proposal

Add `fromDecimalParts(sign, intDigits, fracDigits, expSign, expDigits)` (or a
`parseDecimal(lexeme)`) to `fjs/types/bigfloat`, used by both tokenizers.

### Tasks

- [ ] Design the input shape (parts record vs. lexeme string) against both
      call sites
- [ ] Implement with proof coverage; convert both tokenizers

### Related

- [tokenizer-finish-number-shared](../../../js/todo/tokenizer-finish-number-shared.md)
  — number *completeness* classification, a different concern
- `fjs/types/bigfloat/module.f.mjs` — `decToBin`, the next stage of the same
  pipeline
