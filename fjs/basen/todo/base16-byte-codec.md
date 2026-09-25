## One Base16 codec for byte lists

**Priority:** P4
**Status:** open

### Problem

Nothing in the repository owns the step between a list of bytes and its hex
spelling, so each module that needs it writes its own:

- [`fjs/git/oid`](../../git/oid/module.f.mjs) — `tryFromHex` pairs digits
  with `h * 16 + …`, either case; `toHex` and `hexText` spell an id back in
  lowercase.
- [`fjs/media/datajs/vectors`](../../media/datajs/vectors/module.f.mjs) —
  `bytes` reads lowercase pairs separated by single spaces.
- [`fjs/git/testlib.f.mjs`](../../git/testlib.f.mjs) — `hexBytes` reads a
  continuous string, either case.
- [`fjs/text/percent`](../../text/percent/module.f.mjs) — `escapeByte` reads
  the two digits after a `%`.
- [`fjs/git/refstore`](../../git/refstore/module.f.mjs) — `nameForMessage`
  spells a name's bytes with `toString(16).padStart(2, '0')`.
- [`fjs/website`](../../website/module.f.mjs) — `commitOf` spells an id as
  `String.fromCharCode(...toArray(toHex(id)))`, which is `hexText` written
  again. It also turns the environment's string into code units and screens
  out anything above `0x7f` by hand, because the only hex reader it can reach
  takes bytes.

A run of hex digits read as one number has the same shape one level down.
[`fjs/text/ascii`](../../text/ascii/module.f.mjs)'s `digitsValue` stops at
radix 10 on purpose ("a hexadecimal digit is `hexDigitValue`'s business"), so
every radix-16 reader sums its own digits:
[`fjs/git/config`](../../git/config/module.f.mjs)'s `digitValue` and
`tryDigits` (with their own letter offsets),
[`fjs/media/json/parser`](../../media/json/parser/module.f.mjs)'s
`escapeMapping` over the four digits of a `\u`, and
[`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)'s `stringDecodeScan`
with `(acc << 4) | …`.

### Proposal

One codec, exported where every consumer above can import it: bytes to
lowercase hex, and hex to bytes or a refusal. The consumers differ in what
they accept — either case or lowercase only, pairs run together or separated
by spaces, bytes or a string as input — and which of those the codec offers,
and which stay with the consumer, is the design question. `baseN` in
[`../module.f.mjs`](../module.f.mjs) is `Vec`-shaped and pads by the bit, so
it is a neighbour here rather than the answer.

For digit runs, let `digitsValue` take radix 16 through `hexDigitValue`, or
give it a hexadecimal sibling, so the three readers above ask `text/ascii`.

### Tasks

- [ ] Decide the codec's home and which spellings it accepts.
- [ ] Implement it with a proof at 100%, and move the six byte-list
      consumers above onto it; `fjs/website`'s `commitOf` uses `hexText` at
      the least.
- [ ] A radix-16 digit-run reader in `text/ascii`; move `git/config`,
      `media/json/parser` and `js/tokenizer` onto it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [various-basen-encodings.md](./various-basen-encodings.md) — the other
  encodings this directory tracks.
- [`fjs/text/ascii`](../../text/ascii/module.f.mjs) — `hexDigitValue`,
  `lowerHexDigitValue`, `hexDigitCodePoint` and `digitsValue`, the digit level
  every consumer already shares.
