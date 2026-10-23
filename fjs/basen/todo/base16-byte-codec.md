## One Base16 codec for byte lists

**Priority:** P4
**Status:** open

### Problem

The codec is [`fjs/basen/base16`](../base16/module.f.mjs): `encode` and
`encodeCodePoints` spell a byte list in lowercase, and `decode` (either
case), `decodeCodePoints` (either case, over code points) and `decodeLower`
(lowercase only) read a continuous run of pairs back, or refuse it. A
separator, a prefix or a width stays the caller's grammar, checked around the
codec. `fjs/git/oid`'s `tryFromHex` and `toHex`, `fjs/git/testlib.f.mjs`'s
`hexBytes`, `fjs/zlib/testlib.f.mjs`'s `hex`, `fjs/git/refstore/name`'s
`nameForMessage` and `fjs/media/datajs/vectors`'s `bytes` are on it. These still spell their own:

- [`fjs/types/uint8array`](../../types/uint8array/module.f.mjs) —
  `fromVec` reads a pair back with ``Number(`0x…`)``; it works a bigint at
  a time for a reason its doc gives, which the codec's byte lists do not
  respect, so it is not moved. Its writers, `hexOfByte` and the padding of
  the whole vector's spelling, are `encodeScalar`.
- [`fjs/website`](../../website/module.f.mjs) — `commitOf` turns the
  environment's string into code units and screens out anything above `0x7f`
  by hand, because `fjs/git/oid`'s reader takes bytes; the codec's `decode`
  takes the string and refuses a wide unit itself, but the width check is
  `oid`'s `tryFromHexOf`. It spells the id back with `oid`'s `hexText`.

The list holds modules and test libraries, not proof files. Several
`proof.f.mjs` under `fjs/git` spell the same conversion at their
assertion sites, `refstore`'s many times over, and `oid`'s spells it as
`String.fromCharCode(...toArray(toHex(id)))`; those are fixtures, not consumers with an API of
their own, and each proof can call the codec where it helps, in any later
PR, with nothing to declare.

A run of hex digits read as one number has the same shape one level down,
and it is solved:
[`fjs/text/ascii`](../../text/ascii/module.f.js)'s `hexDigitsValue`
reads one, and `digitsValue` stops at radix 10 on purpose.
[#2787](https://github.com/functionalscript/functionalscript/pull/2787)
added it with the `vdf` demo's `parseHex` on it, and
[#2938](https://github.com/functionalscript/functionalscript/pull/2938)
moved the other readers that summed their own digits onto it:
[`fjs/git/config`](../../git/config/module.f.js)'s `tryDigits`,
[`fjs/media/json/parser`](../../media/json/parser/module.f.mjs)'s
`escapeMapping`, [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)'s
four-digit `\u` and two-digit `\x` escapes, and the `pow` demo's
`parseNBits`. The tokenizer's braced `\u{…}` escape still reads a digit
at a time through `hexDigitValue`, by choice: the run has no length limit,
and its decoder stops growing the value once it leaves Unicode's range,
which reading the whole run as one `bigint` would not.

The writing side has a sibling, a scalar spelled in fixed-width hex, and
the codec covers it as `encodeScalar(width)(value)`: lowercase, padded to
`width` and never cut to it. `hexLiteral` in
[`fjs/media/rust`](../../media/rust/module.f.mjs), `byteLiteral` in
`fjs/nanvm/expected`, `unicodeEscape` in `fjs/js/string_escape`,
`pathByte` in `fjs/text/percent` (in capitals, over it), the `vdf`,
`sign`, `hash` and `secp` demos, and `fjs/text/utf8`'s demo, one byte at
a time, are on it. So are the fixtures of the `git/tree`, `git/walk`,
`git/commit`, `git/packstore`, `crypto/pow` and `media/datajs/parser`
proofs.
`fjs/types/uint8array`'s `hexOfByte` is on it too, and so is the width its
`fromVec` pads the whole vector's spelling to: the bigint-at-a-time reason
above is about the bytes, not the digits. `fjs/text/percent`'s `escapeByte`
reads the two digits after a `%` with `decode`.

### Proposal

One codec, exported where every consumer above can import it: bytes to
lowercase hex, and hex to bytes or a refusal. The consumers differ in what
they accept — either case or lowercase only, pairs run together or separated
by spaces, bytes or a string as input. `fjs/basen/base16` offers both cases
and both inputs, and leaves separators to the consumer, as `vectors` checks
its spaces before `decodeLower`. `baseN` in
[`../module.f.mjs`](../module.f.mjs) is `Vec`-shaped and pads by the bit, so
it is a neighbour here rather than the answer.

What remains for the consumers above: `website`'s `commitOf` could read the
environment's string with `decode` once `fjs/git/oid` offers a width check
over bytes already read, and `uint8array` needs a reason to give up its
bigint-at-a-time spelling, or a codec entry over a whole `Vec` that keeps it.

For digit runs, `hexDigitsValue` in `text/ascii` is the hexadecimal
reader: digit code points to `bigint` or `null`. `digitsValue` keeps its
`0-9` alphabet and radices `2n`..`10n`. A reader uses `hexDigitsValue` for
a bounded hexadecimal run, keeping its grammar, prefix and range rules, and
converts the bounded `bigint` to `number` at its own boundary — as JSON's
and JavaScript's four-digit `\u` escapes do, each still one UTF-16 code
unit, surrogates included.

### Tasks

- [x] Decide the codec's home and which spellings it accepts:
      `fjs/basen/base16`, lowercase out, either case or lowercase only in,
      no separators.
- [x] Implement it with a proof at 100%, and move `git/oid`,
      `git/testlib.f.mjs`, `git/refstore/name` and `media/datajs/vectors`
      onto it.
- [ ] Move the consumers still listed above onto it, or record why each
      stays, `fjs/types/uint8array` included.
- [x] The radix-16 digit-run reader: `hexDigitsValue` in `text/ascii`,
      landed by [#2787](https://github.com/functionalscript/functionalscript/pull/2787)
      with the `vdf` demo on it.
- [x] Move the hexadecimal digit runs in `git/config`, `media/json/parser`,
      `js/tokenizer` and the `pow` demo onto `hexDigitsValue`, preserving
      their admission and bounds — the tokenizer's braced `\u{…}` aside,
      as the problem says; landed by
      [#2938](https://github.com/functionalscript/functionalscript/pull/2938).
- [x] Decide whether a fixed-width hex formatter belongs beside it, and if
      so move the writers above onto it: it does, as `encodeScalar`.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [various-basen-encodings.md](./various-basen-encodings.md) — the other
  encodings this directory tracks.
- [`fjs/text/ascii`](../../text/ascii/module.f.js) — `hexDigitValue`,
  `lowerHexDigitValue`, `hexDigitCodePoint`, `digitsValue` and
  `hexDigitsValue`, the shared digit level.
