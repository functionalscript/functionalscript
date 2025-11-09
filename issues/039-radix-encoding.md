# Various BaseN Encodings

## Base16

## Base32

- [Crockford's base32](https://en.wikipedia.org/wiki/Base32#Crockford's_Base32)

## Base64

[Base64](https://en.wikipedia.org/wiki/Base64). In particular, an implementation for identifiers:

- `0`..`9`: 10
- `A`..`Z`: 26, total: 36
- `a`..`z`: 26, total: 62
- `_`, `$`:  2, total: 64

## Parameters

We can use an additional `stop` bit to signal the end of a bit sequence. Parameters:

  - known/fixed vs unknown/variable size,
  - MSb/LSb.
