# 66D-html-escape-ascii-constants. `html`: name escaped char codes via `fs/text/ascii`

**Priority:** P4
**Status:** open

## Problem

`fs/html/module.f.ts`'s `escapeCharCode` spells the escaped characters as bare
hex code points (lines 70-78):

```ts
const escapeCharCode = (code: number) => {
    switch (code) {
        case 0x22: return '&quot;'
        case 0x26: return '&amp;'
        case 0x3C: return '&lt;'
        case 0x3E: return '&gt;'
        default: return fromCharCode(code)
    }
}
```

`fs/text/ascii/module.f.ts` already exports named constants for exactly these
code points:

| hex | ascii export |
|-----|--------------|
| `0x22` | `quotationMark` (line 52) |
| `0x26` | `ampersand` (line 64) |
| `0x3C` | `lessThanSign` (line 135) |
| `0x3E` | `greaterThanSign` (line 141) |

The `ascii` module is the codebase's home for ASCII code-point names —
`fs/js/tokenizer`, `fs/fsc`, and `fs/djs/tokenizer-new` all import from it rather
than writing numeric literals inline. `html` is the outlier: it already depends
on the `text` layer (`import … from '../text/module.f.ts'`,
`'../text/utf16/module.f.ts'`) but reaches for raw `0x22`/`0x26`/`0x3C`/`0x3E`
instead of the names that exist one module over. A reader has to decode the hex
to see that the four cases are `"`, `&`, `<`, `>`; the named constants say it
directly, and they keep the escape table and the tokenizer agreeing on what each
code point *is* instead of repeating the magic numbers.

## Proposal

Import the four constants from `fs/text/ascii/module.f.ts` and switch on them:

```ts
import { quotationMark, ampersand, lessThanSign, greaterThanSign } from '../text/ascii/module.f.ts'

const escapeCharCode = (code: number) => {
    switch (code) {
        case quotationMark: return '&quot;'
        case ampersand: return '&amp;'
        case lessThanSign: return '&lt;'
        case greaterThanSign: return '&gt;'
        default: return fromCharCode(code)
    }
}
```

This is a separation-of-concerns alignment (the meaning of each code point lives
in `ascii`, the entity mapping stays in `html`), not a behavioural change — the
emitted entities are untouched.

## Why this is filed at P4 (not P5)

It is a one-module edit, but unlike the borderline P5 "two tiny functions differ
in one slot" cleanups it removes magic numbers and brings `html` in line with the
three other modules that already treat `ascii` as the single source for code-point
names — a clarity and consistency win, not just a DRY nicety.

## Tasks

- [ ] Import the four named code points from `fs/text/ascii/module.f.ts` and use
      them in `escapeCharCode`.
- [ ] Confirm `fs/html/proof.f.ts` still passes (`fjs t`) with full branch
      coverage (all four entities plus the default) and `npx tsc` is clean.

## Related

- `fs/text/ascii/module.f.ts` — the ASCII code-point name source.
- [i665-json-html](./665-json-html.md) — adjacent `html` work.
