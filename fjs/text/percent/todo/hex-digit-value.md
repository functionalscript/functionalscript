## hex-digit-value. `fjs/text/percent` rederives the hex-digit codec `fjs/text/ascii` owns

**Priority:** P4
**Status:** open

### Problem

`fjs/text/ascii`'s module doc states the ownership: "It also owns the
hexadecimal digit codec (`hexDigitValue` / `hexDigitCodePoint`), so no
consumer has to rederive the `'0'`, `'a' - 10` and `'A' - 10` offsets for
itself." [`../module.f.mjs`](../module.f.mjs) rederives it:

```js
const hexDigits = '0123456789abcdef'
const hexDigit = c => hexDigits.indexOf(c.toLowerCase())
```

used by `isEscape` and `escapeBytes`. Two codecs for one fact, with two
"not a digit" conventions (`-1` here, `null` there). The percent decoder's
validate-then-decode linearity requirement now lives in its JSDoc at the
source location above; retain it when replacing the per-digit operation.

This code was extracted from `fjs/web`. Both the web server and FSC now
consume this shared text module; the swap belongs here, not in either caller.

### Proposal

Import `hexDigitValue` from [`fjs/text/ascii`](../../ascii/module.f.mjs)
and delete `hexDigits`/`hexDigit`. `isEscape`
tests that both `hexDigitValue(part.codePointAt(0))` and
`…codePointAt(1)` are non-`null`; `escapeBytes` reads the same two values
(non-null by `isEscape`'s guarantee, which its doc already states) and
combines them `hi * 16 + lo`. Behaviour is unchanged — both decoders
accept `0-9a-fA-F` and nothing else. Add a proof row for an uppercase
escape so the swap is pinned.

### Tasks

- [ ] Swap the decoder; drop the local constants.
- [ ] Pin upper/lowercase escapes in [`../proof.f.mjs`](../proof.f.mjs);
      rerun both web and compiler callers.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/todo/hex-digit-owner.md](../../../media/todo/hex-digit-owner.md)
  — the same rederivation twice under `fjs/media`, where the swap is not
  a drop-in.
