# Various BaseN Encodings

> **Note (YAGNI):** Do not implement any of the encodings below until at least
> one module in the codebase needs it. The only existing `Vec → string`
> consumer is `cas/` (which uses `cbase32`); every other hex/numeric formatting
> uses `bigint.toString(16)`, which has different semantics from a stop-bit
> padded codec. When a second real consumer appears, extract a shared
> `base_n(alphabet, normalize?)` factory at that point — `cbase32` is the
> reference implementation. See PR [#824](https://github.com/functionalscript/functionalscript/pull/824)
> for context.

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
