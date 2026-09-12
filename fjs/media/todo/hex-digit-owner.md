## hex-digit-owner. Two more hex-digit decoders under `fjs/media`

**Priority:** P4
**Status:** open

### Problem

`fjs/text/ascii`'s module doc claims the hexadecimal digit codec outright
("It also owns the hexadecimal digit codec (`hexDigitValue` /
`hexDigitCodePoint`), so no consumer has to rederive the `'0'`, `'a' - 10`
and `'A' - 10` offsets for itself"). Two modules in this subtree rederive
it anyway:

```js
// fjs/media/datajs/vectors/module.f.mjs:45-49
const hexDigit = unit =>
    unit >= 0x30 && unit <= 0x39 ? unit - 0x30 :
    unit >= 0x61 && unit <= 0x66 ? unit - 0x57 :
    -1
// fjs/media/json/parser/module.f.mjs:105-111
const hexBase = /**@type {const}*/({ digit: 0x30, AF: 0x41 - 10, af: 0x61 - 10 })
const hexDigit = node => {
    const [tag, digit] = unmapped(node)
    return unitAt(digit) - hexBase[tag]
}
```

Both are named `hexDigit`, each with its own absence convention (`-1` vs a
grammar tag vs `hexDigitValue`'s `null`), and the encode direction proves
the owner is reachable from here: `fjs/media/json/serializer/module.f.mjs`
already imports `hexDigitCodePoint` from exactly that module. One half of
the codec is shared and the other half is copied twice.

Neither copy is a blind swap, which is the part worth writing down:

- `vectors`' decoder is deliberately **lowercase-only** — `isHex` uses it
  to enforce the corpus's canonical spelling, so the general
  `hexDigitValue` (which admits `A-F`) would loosen a validator.
- `json/parser`'s grammar branch already knows which range the digit came
  from, so it subtracts a tag-indexed offset rather than re-classifying —
  but the three offsets are still `fjs/text/ascii`'s constants, restated.

### Proposal

Give the offsets one owner without changing either behaviour. Either
export the named offsets (`digit0`-relative, `'a' - 10`, `'A' - 10`) from
`fjs/text/ascii` and build `hexBase` and the lowercase decoder from them,
or export a lowercase-only decoder beside `hexDigitValue` for `vectors`
and let `json/parser` call `hexDigitValue` with an `assertNotNullish`
(the grammar guarantees success). Decide in the PR; what must not survive
is a third spelling of `- 0x57` with no link to the module that names it.

### Tasks

- [ ] Pick the sharing shape; rewrite both `hexDigit`s through
      `fjs/text/ascii` exports, proofs unchanged (lowercase-only stays
      lowercase-only).
- [ ] `tsc`, `fjs test`.

### Related

- [../../web/todo/hex-digit-value.md](../../web/todo/hex-digit-value.md) —
  the same rederivation in `fjs/web`, where the general decoder *is* a
  drop-in.
- [../../git/todo/ascii-digit-folds.md](../../git/todo/ascii-digit-folds.md)
  — the decimal/octal cousins of the same "reached past `fjs/text/ascii`"
  pattern.
