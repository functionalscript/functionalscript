## Identifier-safe base64

**Priority:** P3
**Status:** open

### Problem

[`fjs/basen/base64`](../base64/module.f.mjs) is the standard RFC 4648 codec,
whose alphabet ends in `+` and `/` and whose output is padded with `=`. None of
those characters can appear in a JavaScript identifier, so a value encoded with
it cannot be used as one. The original report
([GitHub issue #405](https://github.com/functionalscript/functionalscript/issues/405))
asked for an [identifier-safe base64](https://en.wikipedia.org/wiki/Base64)
alongside the other base-N encodings; `fjs/basen/cbase32` (Crockford's base32)
has since shipped, and Base16 is tracked in
[base16-byte-codec](./base16-byte-codec.md). The first consumer is the
content-addressable VM's function text
([cavm-function-to-string](../../../spec/todo/cavm-function-to-string.md)),
which spells a function's hash as an identifier, `$` and then the hash; it
is a fixed-size input, so it needs no stop bit.

### Proposal

An alphabet of 64 identifier characters:

- `0`..`9`: 10
- `A`..`Z`: 26, total: 36
- `a`..`z`: 26, total: 62
- `_`, `$`:  2, total: 64

built on the shared [`baseN`](../module.f.mjs) factory like `base64` and
`cbase32`. Instead of `=` padding, an additional `stop` bit can signal the end
of a bit sequence, as `cbase32` does. Parameters to settle:

- known/fixed vs unknown/variable size,
- MSb/LSb.

### Tasks

- [x] Name the first consumer —
      [cavm-function-to-string](../../../spec/todo/cavm-function-to-string.md).
- [ ] Add the codec under `fjs/basen/` with its proof.

### Related

- [GitHub issue #405](https://github.com/functionalscript/functionalscript/issues/405)
  — the original report.
- [base16-byte-codec](./base16-byte-codec.md) — Base16, the other encoding this
  directory tracks.
- [cavm-function-to-string](../../../spec/todo/cavm-function-to-string.md) —
  the first consumer.
