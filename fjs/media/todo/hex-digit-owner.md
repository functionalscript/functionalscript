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

Give the offsets one owner without changing either behaviour, through
**one new export**: a lowercase-only decoder beside `hexDigitValue` in
`fjs/text/ascii`,

```ts
/**
 * The value of a lowercase hex digit, or `null`: `hexDigitValue` without
 * `A-F`, and with an integer guard — a non-integer such as `97.5` is `null`,
 * never the `10.5` a bare range test would spell.
 */
export const lowerHexDigitValue: (codePoint: number) => Nullable<number>
```

The guard is `Number.isInteger(codePoint) && …` before the range tests,
the shape [`fjs/todo/unguarded-numeric-domains.md`](../../todo/unguarded-numeric-domains.md)
names for a `number` parameter that means a code point. That issue
already records `hexDigitValue`'s own missing guard; this export is born
with one, and is not added to that issue's list because it never has
the defect.

which `vectors` uses in place of its own (reading `null` where it read
`-1`), while `json/parser` drops `hexBase` and calls the existing
`hexDigitValue` with an `assertNotNullish` — the grammar branch already
guarantees the digit is one. Publishing the three offsets themselves was
weighed and rejected: they are a representation detail of the codec, and
exporting them would invite a fourth hand-rolled decoder rather than end
the third. The `ascii` module doc's ownership claim then holds.

### Tasks

- [ ] Add `lowerHexDigitValue` to `fjs/text/ascii` with a proof; rewrite
      both `hexDigit`s, proofs unchanged (lowercase-only stays
      lowercase-only).
- [ ] `tsc`, `fjs test`.

### Related

- [../../web/todo/hex-digit-value.md](../../web/todo/hex-digit-value.md) —
  the same rederivation in `fjs/web`, where the general decoder *is* a
  drop-in.
- [../../git/todo/ascii-digit-folds.md](../../git/todo/ascii-digit-folds.md)
  — the decimal/octal cousins of the same "reached past `fjs/text/ascii`"
  pattern.
