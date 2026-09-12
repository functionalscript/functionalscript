## hex-digit-value. `fjs/web` rederives the hex-digit codec `fjs/text/ascii` owns

**Priority:** P4
**Status:** open

### Problem

`fjs/text/ascii`'s module doc states the ownership: "It also owns the
hexadecimal digit codec (`hexDigitValue` / `hexDigitCodePoint`), so no
consumer has to rederive the `'0'`, `'a' - 10` and `'A' - 10` offsets for
itself." `fjs/web/module.f.mjs:58-64` rederives it:

```js
const hexDigits = '0123456789abcdef'
const hexDigit = c => hexDigits.indexOf(c.toLowerCase())
```

used by `isEscape` and `escapeBytes`. Two codecs for one fact, with two
"not a digit" conventions (`-1` here, `null` there) — and this one costs:
`percentDecode`'s own doc makes linearity a stated requirement (a 15 KB
target of 5,000 escapes was 140 ms of event loop), yet the per-character
path is a `toLowerCase()` string allocation plus a scan of a 16-character
string, twice per escape, where a code-point comparison would do.
`fjs/web` already imports four other `fjs/text` modules, so no dependency
was being avoided.

### Proposal

Import `hexDigitValue` and delete `hexDigits`/`hexDigit`. `isEscape`
tests that both `hexDigitValue(part.codePointAt(0))` and
`…codePointAt(1)` are non-`null`; `escapeBytes` reads the same two values
(non-null by `isEscape`'s guarantee, which its doc already states) and
combines them `hi * 16 + lo`. Behaviour is unchanged — both decoders
accept `0-9a-fA-F` and nothing else. Add a proof row for an uppercase
escape so the swap is pinned.

### Tasks

- [ ] Swap the decoder; drop the local constants.
- [ ] Pin an uppercase escape in the proof.
- [ ] `tsc`, `fjs test`.

### Related

- [../../media/todo/hex-digit-owner.md](../../media/todo/hex-digit-owner.md)
  — the same rederivation twice under `fjs/media`, where the swap is not
  a drop-in.
