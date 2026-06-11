# 189. `asn.1`: a `decodeAll` unfold for "consume a `Vec` until empty"

**Priority:** P3
**Status:** done

Two `asn.1` decoders grow an array by applying a `(Vec) => [item, Vec]` step until
the input vector is exhausted — the same imperative unfold, written twice:

```ts
// fs/asn.1/module.f.ts:229  — decodeObjectIdentifier
let tail = rest
while (length(tail) > 0n) {
    const [value, next] = b128decode(tail)
    result = [...result, value]
    tail = next
}
```

```ts
// fs/asn.1/module.f.ts:250  — decodeSequence
let result: readonly Record[] = []
while (length(v) !== 0n) {
    const [record, rest] = decode(v)
    result = [...result, record]
    v = rest
}
```

Both are `apply step until length === 0n, collecting the items`, differing only in
the step (`b128decode` vs `decode`) and the item type (`bigint` vs `Record`).

## Proposed abstraction

A small generic combinator that unfolds a `Vec` with a step until empty:

```ts
const decodeAll = <T>(step: (v: Vec) => readonly [T, Vec]) => (v: Vec): readonly T[] => {
    let result: readonly T[] = []
    while (length(v) !== 0n) {
        const [item, rest] = step(v)
        result = [...result, item]
        v = rest
    }
    return result
}
```

Then `decodeSequence = decodeAll(decode)` and the OID tail becomes
`decodeAll(b128decode)(rest)`.

The natural home could be `asn.1` itself (a local helper) or — since it is purely
"drain a `Vec` with a step" — `bit_vec`. A lazy `List`-building variant would also
let it shed the `O(n²)` `[...result, item]` spread, aligning with the project's
no-mutation, lazy-list bias.

## Why this qualifies

- DRY with two real in-module consumers of the identical drain loop.
- Names the recurring "decode a homogeneous stream of length-delimited items"
  pattern, so the next ASN.1 collection decoder reuses it.

## Caveats

- `decodeObjectIdentifier` prepends the special first byte (`first`, `second`)
  *before* the loop (`asn.1:224-227`), so `decodeAll` covers only the loop tail,
  not the whole function.
- The element types differ, so the combinator must be generic.
- `base128.decode` (`fs/base128/module.f.ts:37`) is itself a single-varint reader;
  this `decodeAll` is the right place for the "repeat until empty" wrapper rather
  than adding a base128-specific `decodeAll` — keep the loop generic over `step`.

## Related

- [i157](./README.md) — extracting shared parser/serializer cores; same flavor of
  "the walk is duplicated, the per-item op differs".
