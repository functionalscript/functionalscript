## encode-at-max-length. `vecToCBase32` throws on JavaScriptCore for a `maxLength` vector

**Priority:** P3
**Status:** open

### Problem

`vecToCBase32` cannot encode the largest bit vector on JavaScriptCore (Safari,
Bun):

```js
vecToCBase32(vec(maxLength)(0n))
// Bun: RangeError: Out of memory: BigInt generated from this operation is too big
```

It appends the stop bit and its fill to its input before encoding:

```js
// vecToCBase32
const padded = concat(v)(vec(extraLen)(last))
return vec5xToCBase32(padded)
```

`extraLen` is 1 to 5, so for a `maxLength` input `padded` is up to five bits
past `maxLength` — and `maxLength` is the size JavaScriptCore's `BigInt` can
hold. V8 (Node, Chrome) holds more, so the same call succeeds there and the
failure depends on the engine.

The input is valid: `maxLength` is the largest vector `bit_vec` builds, and
`cBase32ToVec` decodes its encoding. The proof's `decodeAtMaxLengthSucceeds`
builds that encoding by hand for this reason.

The [`bitGroupDemo`](../../../website/demo/bits/module.f.mjs) refuses text
that leaves no room for a stop bit, so the CBase32 demo stops one byte short
of the limit rather than crashing on Safari.

### Proposal

Never build the padded vector. Encode every whole five-bit group of `v` with
`vec5xToCBase32`, then the last character from the remaining bits, the stop
bit and the fill — as `base64/encode` already avoids building a vector past
its input for its own last character.

### Tasks

- [ ] encode a `maxLength` vector on every engine
- [ ] a proof encoding `vec(maxLength)(0n)` with `vecToCBase32` directly,
      replacing the hand-built string in `decodeAtMaxLengthSucceeds`
- [ ] remove the stop-bit refusal from `bitGroups` in `fjs/website/demo/bits`

### Related

- [178-cbase32-padding-into-bit-vec](./178-cbase32-padding-into-bit-vec.md):
  the same padding code, seen as `bit_vec` logic in the wrong module
