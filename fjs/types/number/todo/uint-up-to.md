## uint-up-to. "A non-negative integer up to `max`" is written five times, and the copies disagree about `-0`

**Priority:** P4
**Status:** open

### Problem

Six modules test that a number is an integer in `0..max`, each with its
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
// effects/node isPort — admits -0
export const isPort = port => Number.isInteger(port) && port >= 0 && port <= maxPort
```

Two reject `-0`, four admit it, and `u8` is `isByte` under another
name in a module that could import it. Whether `-0` is a byte, an index
or a code unit is one question with one answer, and today it has two.

### Proposal

[`module.f.mjs`](../module.f.mjs) owns the predicate:

```ts
/** An integer in `0..max`, `-0` excluded: the one spelling of "an unsigned integer that fits". */
export const isUintUpTo: (max: number) => (n: unknown) => n is number
```

`isByte = isUintUpTo(0xFF)`, `isIndex = isUintUpTo(Infinity)`, `u8`
becomes `isByte`, `u16 = isUintUpTo(0xFFFF)`, `isPort = isUintUpTo(maxPort)`,
and `bitIndex` asserts on it. `Infinity` is the bound for `isIndex` because it is what `isIndex`
admits today — any canonical non-negative integer, `1e100` included —
so the bound changes nothing. Whether an index should stop at
`Number.MAX_SAFE_INTEGER` is a separate question with a separate break,
to be filed on its own if anyone wants it.

The `-0` decision is the one break, and it is deliberate: the two
spellings that reject `-0` do so with an explicit clause, so that is the
intended rule, and the four that admit it are the ones that never
asked. Routing them through `isUintUpTo` refuses `-0` where it passed
before: `bitIndex`, so `bit_set`'s `numberOps`, `bigintOps` and
`bitSet` assert on `-0` instead of reading it as bit zero; `u8`, so a
`-0` byte is refused by `utf8`'s decoder; `u16`, so a `-0` code unit is
refused by `utf16`'s; `isPort`, so `isPort(-0)` is `false` and
`fjs/effects/node` refuses a `-0` port. The implementing PR declares this under
`Changelog:` as a `**BREAKING CHANGES:**` item naming those exports.

### Tasks

- [ ] `isUintUpTo`, proved, with the `-0` rule stated.
- [ ] The six sites through it; the `-0` break declared in the PR's
      `Changelog:` section.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [non-integer-code-points](../../../text/todo/non-integer-code-points.md)
  — asks for one `isCodePoint` and names `u8`/`u16` as the shape to
  copy; this gives the shape an owner instead.
