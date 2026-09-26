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
arithmetic the owners exist to name. `bit_vec` names one direction of
that conversion, `bytesIn`, bits to whole bytes, and not the other.

### Proposal

One constructor and the missing direction in `fjs/types/bit_vec`:

```ts
/** `uint` padded to whole bytes, at least `minBytes` of them. */
export const wholeBytes: (minBytes: bigint) => (uint: Unpacked) => Vec
/** The bits in `bytes` whole bytes; the inverse of `bytesIn` on a whole-byte count. */
export const bitsIn: (bytes: bigint) => bigint
```

`round8`'s `v` and `tagEncode` call `wholeBytes`, `byteLen` becomes
`byteLength(v)`, `lenDecode` converts its byte count through `bitsIn`
— not `bytesIn`, which divides where `lenDecode` must multiply — and
`sign`'s `int2octets` shares `wholeBytes`.

### Tasks

- [ ] `wholeBytes` and `bitsIn` with proofs; the four sites through them.
- [ ] `tsc`, `fjs test`; the ASN.1 proofs pass unchanged.

### Related

- [../../types/bit_vec/todo/byte-aligned-vec.md](../../types/bit_vec/todo/byte-aligned-vec.md)
  — a byte-aligned type; this constructor would produce one.
