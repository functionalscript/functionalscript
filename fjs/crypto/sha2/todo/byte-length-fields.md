## byte-length-fields. Consumers re-derive `Sha2` byte lengths from bit counts

**Priority:** P4
**Status:** open

### Problem

`Sha2` publishes only bit counts (`fjs/crypto/sha2/types.ts:58-59`:
`hashLength`, `blockLength`), so every consumer that needs bytes re-does the
conversion — with two different spellings:

```js
// fjs/crypto/hmac/module.f.mjs:47-48
const { blockLength } = hashFunc
const p = repeat(blockLength >> 3n)

// fjs/crypto/sign/module.f.mjs:78
const rep = repeat(divUp8(hf.hashLength))
```

Same three-step idiom — take a bit length off a `Sha2`, convert to bytes,
`repeat` a `vec8` constant (`oPad`/`iPad` at `hmac:32,37`, `x01`/`x00` at
`sign:52-53`) — written twice, once as `>> 3n` and once as `divUp8`
(`fjs/types/bigint/module.f.mjs`). The reader has to work out per site whether
the two roundings agree (they do: SHA-2 lengths are byte-multiples), and a
third variant of "digest bits → scalar" arithmetic lives in
`fjs/crypto/pow/module.f.mjs:79-80`.

### Proposal

Compute the byte counts once where the record is built — `sha2(...)`
(`fjs/crypto/sha2/module.f.mjs:257`) — and publish them on the type:

```ts
// fjs/crypto/sha2/types.ts
readonly hashLength: bigint     // bits (unchanged)
readonly blockLength: bigint    // bits (unchanged)
readonly hashBytes: bigint
readonly blockBytes: bigint
```

`hmac` and `sign` then read `blockBytes`/`hashBytes` instead of converting,
and the bits-vs-bytes decision has one owner.

### Tasks

- [ ] Add the byte fields to `Sha2` and `sha2(...)`; proof-cover them for all
      four variants.
- [ ] `hmac`: `repeat(blockBytes)`; `sign`: `repeat(hashBytes)`.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/crypto/sign/todo/computek-digest-param.md` — adjacent `sign`/sha2
  interface cleanup.
