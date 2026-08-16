## byte-guard-accepts-non-integers. `utf8ByteToCodePointOp`'s domain guard lets fractional bytes through

**Priority:** P4
**Status:** open

### Problem

`utf8ByteToCodePointOp` (`fjs/text/utf8/module.f.mjs:201-204`) guards its
input domain with a bare range comparison:

```ts
export const utf8ByteToCodePointOp = (byte, state) => {
    if (byte < 0x00 || byte > 0xff) {
        return [[errorMask], state]
    }
```

`U8` is just `number`, so a fractional value in `[0x00, 0xff]` passes the
guard. `restart` then dispatches it on `byte < contTag`, and a fractional
value below `0x80` is emitted **as a code point**, untagged:

```
toCodePointList([1.5])   // [1.5]        <- a fraction reported as valid
toCodePointList([0.5])   // [0.5]
toCodePointList([200.5]) // [-2147483448] <- tagged, but the payload is fractional
toCodePointList([255.5]) // [2147483648]
```

Only the last is right, and only by accident: `255.5 > 0xff` is the one
fractional case the range comparison happens to catch.

The UTF-16 side already got this right. `u16`
(`fjs/text/utf16/module.f.mjs`) is `Number.isInteger(i) && isInU16Range(i)`,
and carries a doc comment explaining exactly why the integer check is load
bearing: the BMP/high-surrogate/low-surrogate predicates partition only the
*integers* in the range, so a fractional value falls between two of them and
is misclassified downstream. UTF-8's `contTag` / `isLeadByte` /
continuation-range dispatch has the same property and the same hole, but no
integer check.

`fjs/text/utf16/proof.f.mjs` pins the UTF-16 behavior with two dedicated
cases (`[56319.5]` and `[55296, 56319.5]`). `fjs/text/utf8/proof.f.mjs` has
no fractional-byte case at all, which is why the hole survived.

### Note

This was found while making the UTF-16 out-of-range guard emit `errorMask`
instead of a magic `0xffffffff` (the now-deleted
`fjs/text/utf16/todo/decoder-oob-sentinel.md`). That TODO asserted the two
guards were "structurally identical — raw unit out of range → emit one error
unit, pass `state` through unchanged". That is true of the *return*, and the
sentinel fix landed, but it is **not** true of the *condition*: UTF-8's is
strictly weaker. Only the sentinel half was in scope there, so this was split
out rather than folded in — it is a behavior change to a decoder's accepted
domain and wants its own proof cases.

### Proposal

Give UTF-8 the same domain predicate shape UTF-16 has, so the two guards
differ only in their bounds:

```ts
const u8 = i => Number.isInteger(i) && isInU8Range(i)
```

with `isInU8Range = contains(0x00, 0xff)` from `types/range`, matching
`isInU16Range`. Then the guard reads `if (!u8(byte))`.

Before landing, settle one thing: `toCodePointList([1.5])` currently returns
`[1.5]` and would return `[errorMask]`. Nothing in-tree should depend on
that — the fractional path is unreachable from `u8List`/`Vec` inputs, which
are the only callers in the repo — but confirm with a differential over the
UTF-8 proof corpus that **integer** inputs are byte-identical, since the
guard is on the hot path for every byte decoded.

### Tasks

- [ ] Add `u8` alongside the existing predicates; rewrite the guard as
      `if (!u8(byte))`.
- [ ] Mirror the UTF-16 doc comment explaining why the integer check matters.
- [ ] Add proof cases for a fractional byte alone and a fractional byte
      arriving mid-sequence (with a pending multi-byte state), mirroring
      `fjs/text/utf16/proof.f.mjs`.
- [ ] Differential over integer inputs must be byte-identical; `npx tsc`,
      `fjs t`.

### Related

- `fjs/text/utf16/module.f.mjs` — `u16` and its doc comment; the shape to
  copy.
- `fjs/text/utf8/todo/error-tag-layout-constants.md` — adjacent cleanup in
  the same file's error paths.
