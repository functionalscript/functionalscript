## whole-byte-vec. Padding a uint to whole bytes is spelled three ways, two of them here

**Priority:** P4
**Status:** open

### Problem

"This uint as a big-endian vector of whole bytes" is a `bit_vec`
operation, and `fjs/types/bigint` names its rounding, `roundUp8`. This
module derives it twice, differently:

```js
// round8, used by lenEncode, encodeRaw and encodeInteger
const byteLen = divUp8(length)
return { byteLen, v: vec(byteLen << 3n)(uint) }
// tagEncode — the same rounding with a one-byte floor, not through round8
vec(max(divUp8(bitLength(tag)))(1n) << 3n)(tag)
// lenDecode — bytes to bits by hand, twice
pop((first & 0x7Fn) << 3n)(rest1) … return [byteLen << 3n, rest2]
```

and `fjs/crypto/sign` spells it a third way, `vec(roundUp8(qlen))`.
`divUp8(x) << 3n` is `roundUp8(x)`; the `<< 3n` conversions are the
arithmetic the owners exist to name.

### Proposal

One constructor in `fjs/types/bit_vec`:

```ts
/** `uint` padded to whole bytes, at least `minBytes` of them. */
export const wholeBytes: (minBytes: bigint) => (uint: Unpacked) => Vec
```

`round8`'s `v` and `tagEncode` call it, `byteLen` becomes
`byteLength(v)`, `lenDecode` converts through `bytesIn`, and `sign`'s
`int2octets` shares it.

### Tasks

- [ ] `wholeBytes` with a proof; the four sites through it.
- [ ] `tsc`, `fjs test`.

### Related

- [../../types/bit_vec/todo/byte-aligned-vec.md](../../types/bit_vec/todo/byte-aligned-vec.md)
  — a byte-aligned type; this constructor would produce one.
