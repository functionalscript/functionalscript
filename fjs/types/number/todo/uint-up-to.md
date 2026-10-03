## uint-up-to. "A non-negative integer up to `max`" is written five times, and the copies disagree about `-0`

**Priority:** P4
**Status:** open

### Problem

Five modules test that a number is an integer in `0..max`, each with its
own spelling, and the spellings do not agree on whether `-0` is one:

```js
// types/number isByte
export const isByte = b => isInteger(b) && b >= 0 && b <= 0xFF && !sameValue(b, -0)
// types/function/length isIndex
export const isIndex = n => Number.isInteger(n) && n >= 0 && !Object.is(n, -0)
// types/bit_set bitIndex — admits -0
assert(isInteger(n) && 0 <= n && n <= max, ['bit index outside 0..max', n, max])
// text/utf8 u8 — admits -0, and is isByte again
const u8 = i => Number.isInteger(i) && isInU8Range(i)
// text/utf16 u16 — the same shape for 0xFFFF
const u16 = i => Number.isInteger(i) && isInU16Range(i)
```

Two reject `-0`, three admit it, and `u8` is `isByte` under another
name in a module that could import it. Whether `-0` is a byte, an index
or a code unit is one question with one answer, and today it has two.

### Proposal

[`module.f.mjs`](../module.f.mjs) owns the predicate:

```ts
/** An integer in `0..max`, `-0` excluded: the one spelling of "an unsigned integer that fits". */
export const isUintUpTo: (max: number) => (n: unknown) => n is number
```

`isByte = isUintUpTo(0xFF)`, `isIndex = isUintUpTo(Infinity)` (or the
`2 ** 53 - 1` an index actually is), `u8` becomes `isByte`,
`u16 = isUintUpTo(0xFFFF)`, and `bitIndex` asserts on it. The `-0`
decision is made once, in its doc.

### Tasks

- [ ] `isUintUpTo`, proved, with the `-0` rule stated.
- [ ] The five sites through it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [non-integer-code-points](../../../text/todo/non-integer-code-points.md)
  — asks for one `isCodePoint` and names `u8`/`u16` as the shape to
  copy; this gives the shape an owner instead.
