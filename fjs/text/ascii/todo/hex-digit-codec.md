## Own the hex-digit ↔ value codec

**Priority:** P3
**Status:** open

### Problem

The mapping between a hex-digit code point and its numeric value — the three
offsets `digit0`, `latinSmallLetterA - 10`, `latinCapitalLetterA - 10` — is
recomputed in three modules, in both directions:

```js
// fjs/media/json/serializer/module.f.mjs:48-50 (value → char)
const hexDigit = value =>
    fromCharCode(value < 10 ? digit0 + value : latinSmallLetterA + value - 10)

// fjs/js/tokenizer/module.f.mjs:599-612 (char → value, range-map dispatch)
const parseUnicodeCharHex = offset => state => input => { ... input - offset ... }

// fjs/djs/tokenizer/module.f.mjs:360-366 (char → value, ternary chain)
const digit = contains(...digitRange)(cp) ? cp - digit0
    : contains(...rangeCapitalAF)(cp) ? cp - (latinCapitalLetterA - 10)
    : cp - (latinSmallLetterA - 10)
```

The `af`/`AF` ranges are likewise built independently in `js/tokenizer:153-154`
and `djs/tokenizer:336`. Note the djs copy's fallthrough: the last branch
assumes lowercase without checking, so a non-hex code point silently yields a
garbage digit, where the js copy has a real reject path.

### Proposal

`fjs/text/ascii` already owns `digit0`, `latinSmallLetterA`,
`latinCapitalLetterA` — and `latinCapitalLetterF`/`latinSmallLetterF`, which
exist for no other reason. Add:

- `hexDigitValue: (cp: number) => Nullable<number>`
- `hexDigitCodePoint: (v: number) => number`
- the shared digit/`af`/`AF` ranges

and convert the three consumers.

### Tasks

- [ ] Add the codec pair and ranges with proof coverage
- [ ] Convert `media/json/serializer`, `js/tokenizer`, `djs/tokenizer`
