# 65Z-asn1-tag-codec-table. `asn.1`: collapse the parallel encode/decode tag switches into one codec table

**Priority:** P4
**Status:** open

## Problem

`fs/asn.1/module.f.ts` dispatches on the same set of universal tags twice — once
to encode, once to decode — in two separate `switch (tag)` statements:

```ts
// fs/asn.1/module.f.ts:303
const recordToRaw = ([tag, value]: SupportedRecord): Vec => {
    switch (tag) {
        case boolean:           return encodeBoolean(value)
        case integer:           return encodeInteger(value)
        case octetString:       return encodeOctetString(value)
        case objectIdentifier:  return encodeObjectIdentifier(value)
        case constructedSequence: return encodeSequence(...value)
        case constructedSet:    return encodeSet(...value)
    }
}

// fs/asn.1/module.f.ts:320
const rawToRecord = (raw: Raw): Record => {
    const [tag, value] = raw
    switch (tag) {
        case boolean:           return [boolean,          decodeBoolean(value)]
        case integer:           return [integer,          decodeInteger(value)]
        case octetString:       return [octetString,      decodeOctetString(value)]
        case objectIdentifier:  return [objectIdentifier, decodeObjectIdentifier(value)]
        case constructedSequence: return [constructedSequence, decodeSequence(value)]
        case constructedSet:    return [constructedSet,   decodeSet(value)]
        default:                return encodeRaw(raw)
    }
}
```

Every supported tag appears in both switches and *must* appear in both — drop
a case from one side and round-tripping silently breaks for that tag. The
encoder/decoder are a logical pair held together by convention, not by the
type system.

## Proposal

Express the supported tags as a single table of `{ encode, decode }` pairs,
keyed by tag. `recordToRaw` and `rawToRecord` each look up the relevant half:

```ts
type Codec<T> = {
    readonly encode: (value: T) => Vec
    readonly decode: (v: Vec) => T
}

const codecs = {
    [String(boolean)]:             { encode: encodeBoolean,          decode: decodeBoolean          },
    [String(integer)]:             { encode: encodeInteger,          decode: decodeInteger          },
    [String(octetString)]:         { encode: encodeOctetString,      decode: decodeOctetString      },
    [String(objectIdentifier)]:    { encode: encodeObjectIdentifier, decode: decodeObjectIdentifier },
    [String(constructedSequence)]: { encode: (v: Sequence) => encodeSequence(...v), decode: decodeSequence },
    [String(constructedSet)]:      { encode: (v: Set)      => encodeSet(...v),      decode: decodeSet      },
} as const
```

`recordToRaw([tag, value])` becomes `codecs[String(tag)].encode(value)`; the
decode side either looks up `codecs[String(tag)]` (returning the supported
record) or falls back to `encodeRaw(raw)` for unknown tags.

The exact API shape is open — a `Map<bigint, Codec<unknown>>`, a `Record`
keyed by stringified tag (bigints aren't valid object keys), or a small
switch-on-tag helper that returns the codec — but the principle is one
declaration site per (tag, encode, decode) triple.

## Why this qualifies

- **Single source of truth.** A new tag is added by inserting one row in the
  table instead of remembering to extend two switches. Dropping a tag from
  only one side stops being possible.
- **Separation of concerns.** The "which tags do we support" question is
  data, not control flow. Keeping it as data also makes it cheap to query
  (e.g. "is this tag supported?") without writing yet another switch.

## Caveats

- `SupportedRecord` is a discriminated union keyed by tag (`fs/asn.1/module.f.ts:272-278`),
  so the codec values are heterogeneously typed. The table approach loses the
  per-branch payload typing that the switch currently gives `recordToRaw`. A
  small per-tag helper that types `encode` against the union branch may be
  needed to keep the compiler honest — otherwise the win shrinks to "decode
  side only".
- `bigint` is not a valid `Record` key in TypeScript; the table will need
  string keys (`String(tag)`) or a `Map<bigint, Codec<unknown>>`. Both work;
  pick whichever reads better next to existing code.
- The unsupported-tag fallback in `rawToRecord` (`default: return encodeRaw(raw)`)
  must be preserved — the table only owns the supported branches.

## Related

- [i189](./189-asn1-decode-all-unfold.md) — the other DRY target in `asn.1`,
  the "drain a `Vec` with a step until empty" unfold. Same flavour: name a
  recurring shape once instead of inlining it per call site.
