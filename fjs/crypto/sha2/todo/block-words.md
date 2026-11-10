## The words of a block, written in `sha1` and in `sha2`

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) exports `fromWords`, the number a list
of words spells most significant first, and
[`fjs/crypto/sha1`](../../sha1/module.f.mjs) imports it for the digest.
The inverse, a block as its sixteen words, has no shared owner: `sha1`
writes `words`, and `sha2`'s `framingInit` writes `at` and a sixteen-call
literal in `compress`:

```js
// sha1
const words = u => Array.from({ length: 16 }, (_, i) => u >> BigInt(15 - i) * wordLength & m)
// sha2, inside framingInit
const at = u => i => (u >> (i << logBitLen)) & m
const compress = i => u => {
    const a = at(u)
    return compressV16(...i)([a(15n), a(14n), a(13n), a(12n), a(11n), a(10n), a(9n), a(8n), a(7n), a(6n), a(5n), a(4n), a(3n), a(2n), a(1n), a(0n)])
```

Same contract, two spellings; a correction to the masking or the word
order is made twice.

### Proposal

`toWords = wordLength => count => u => readonly bigint[]` beside
`fromWords`, written once with `generate` from
[`fjs/types/array/generate`](../../../types/array/generate/module.f.js).
`sha1`'s `words` is `toWords(wordLength)(16)`; `framingInit`'s `compress`
is `compressV16(...i)(toWords(bitLength)(16)(u))`, and `at` goes. One
proof entry pins the round trip with `fromWords`.

### Tasks

- [ ] `toWords` with its round-trip proof.
- [ ] `sha1` and `framingInit` over it.
- [ ] `tsc` and the suites under `fjs/crypto`.

### Related

- [framing-init-is-the-api](./framing-init-is-the-api.md) — the other
  seam between the two.
