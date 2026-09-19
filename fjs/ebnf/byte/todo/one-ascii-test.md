## one-ascii-test. `ascii` and `isAscii` each decode and test the `0x80` boundary

**Priority:** P5
**Status:** open

### Problem

```js
// fjs/ebnf/byte/module.f.mjs
export const ascii = s => {
    const a = toArray(stringToCodePointList(s))
    assert(a.every(c => c < 0x80), ['not ASCII', s])
    return a
}
const isAscii = s => toArray(stringToCodePointList(s)).every(c => c < 0x80)
```

The module's job is refusing non-ASCII in a byte grammar, and the criterion
is spelled twice with two absence conventions.

### Proposal

`codePoints` once, `isAsciiCodePoint` once, `ascii` as `isAscii` plus the
assertion over the array it already has.

### Tasks

- [ ] Rewrite; proofs unchanged; `tsc`, `fjs test`.

### Related

- [`../../todo/symbol-domain-owner.md`](../../todo/symbol-domain-owner.md) —
  the same shape one domain over.
