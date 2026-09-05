## unicode-escape-accumulator. The `\uXXXX` accumulator has no owner, so both tokenizers grew one

**Priority:** P4
**Status:** open

### Problem

`fjs/js/string_escape` declares itself "one source of truth" for string
escapes and deliberately excludes `\uXXXX` because "its meaning is computed
from the digits that follow rather than looked up". The consequence is that
the computed half has no owner, and each decode side hand-rolled its own
four-hex-digit accumulator:

```js
// fjs/js/tokenizer/module.f.mjs:534-541 — big-endian placement by index
const newUnicode = state.unicode | (hexValue << (3 - state.hexIndex) * 4)
return [empty, state.hexIndex === 3 ? { kind: 'string', value: ... } : ...]

// fjs/djs/tokenizer/module.f.mjs:404-407 — shift-and-or
const acc = (state.acc << 4) | unwrapHexDigitValue(cp)
return state.count === 3 ? [[acc], { kind: 'normal' }] : [null, { kind: 'unicode', acc, count: state.count + 1 }]
```

Two different spellings of one arithmetic, two different state field names,
and the escape's width (the literal `3`) stated four times across two
modules. A drift here is a tokenizer disagreement about what a string
literal means — exactly what `string_escape`'s header exists to prevent.

### Proposal

Give `fjs/js/string_escape` the accumulator it currently disowns: a small
step function plus the width constant, e.g.

```js
export const unicodeEscapeDigits = 4
/** One hex digit into the running escape value; the caller counts digits. */
export const pushHexDigit = acc => hexDigitValue => (acc << 4) | hexDigitValue
```

(or a `{ acc, count } → next-state | code point` step, if both callers can
share the completion test too). Both tokenizers then express their
`unicode`/`unicodeChar` states through it, and only `string_escape` knows
the escape is four digits wide. The JS tokenizer's index-based placement
becomes the shift-and-or form — behavior-identical for left-to-right input.

### Tasks

- [ ] Add the accumulator to `fjs/js/string_escape`; port both tokenizer
      states.
- [ ] `tsc`, `fjs t`; both tokenizers' escape proofs pin the semantics.

### Related

- [667-js-tokenizer-handler-literals.md](./667-js-tokenizer-handler-literals.md)
  — names `u → unicodeChar` as the one hand-written row of the escape
  dispatch table; this issue owns what that row dispatches *to*.
- `fjs/djs/tokenizer/module.f.mjs` — the second copy lives there; this
  issue sits here because the fix lands in `fjs/js/string_escape`.
