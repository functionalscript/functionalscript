## digits-from-text-ascii. `isPart` re-reads a decimal digit run `text/ascii` owns

**Priority:** P5
**Status:** open

### Problem

`isPart` in [`module.f.mjs`](../module.f.mjs) decides that a version
component is digits by walking the string itself:

```js
// isPart
const isPart = part =>
    part.length !== 0
    && [...part].every(c => isDigit(c.charCodeAt(0)))
    && Number.isSafeInteger(Number(part))
```

[`fjs/text/ascii`](../../../text/ascii/module.f.mjs) owns a decimal
digit run as `digitsValue(10n)` and `isCanonicalDigits`, which
`fjs/git/object` and `fjs/git/ident` already read through.

### Proposal

`isPart`, or `tryParse` directly, reads the part's code units through
`digitsValue(10n)` and keeps only the safe-integer bound as its own.

### Tasks

- [ ] `tryParse` through `digitsValue`; the local walk deleted.
- [ ] `tsc`, `fjs test`.
