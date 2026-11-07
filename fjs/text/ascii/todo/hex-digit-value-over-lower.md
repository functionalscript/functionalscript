## `hexDigitValue` restates `lowerHexDigitValue`

**Priority:** P5
**Status:** open

### Problem

[`module.f.js`](../module.f.js) documents `lowerHexDigitValue` as
`hexDigitValue` without `A-F`, but the code says it the other way round:
the integer guard and the two lowercase arms are written in both, and the
uppercase arm is the only difference. The non-integer rule that
[non-integer-code-points](../../todo/non-integer-code-points.md) cares
about is maintained in two chains.

### Proposal

`hexDigitValue` asks `lowerHexDigitValue` first and adds the uppercase arm
on a `null`, so the shared chain is written once.

### Tasks

- [ ] `hexDigitValue` over `lowerHexDigitValue`; the suite under
      `fjs/text/ascii`.
