# 66A-divup8-bits-to-bytes. Share `divUp8` / `roundUp8` bit→byte rounding in `types/bigint`

**Priority:** P4
**Status:** open

## Problem

Two independent modules define the *same* bit-length → byte-length helper by
specialising `divUpE2(3n)` (divide by `2^3 == 8`, rounding up):

```ts
// fs/crypto/sign/module.f.ts:14-16
const roundUp8: Unary = roundUpE2(3n)
const divUp8 = divUpE2(3n)
```

```ts
// fs/asn.1/module.f.ts:68
const divUp8 = divUpE2(3n)
```

Both modules already `import { divUpE2 } from '../../types/bigint/module.f.ts'`
(and `sign` also imports `roundUpE2`), then re-derive the identical `3n`
specialisation locally. This is a textbook DRY violation: the same expression,
the same magic exponent `3n`, copied into two consumers.

The duplicated helpers are real, exercised code, not speculative:

- `sign`: `int2octets = vec(roundUp8(qlen))` (`:39`) and
  `rep = repeat(divUp8(hf.hashLength))` (`:78`).
- `asn.1`: `vec(max(divUp8(bitLength(tag)))(1n) << 3n)(tag)` (`:71`) and
  `const byteLen = divUp8(length)` (`:134`).

So there are **two real consumers today** — the threshold AGENTS.md sets for
extracting a shared helper ("only extract once the second real consumer
exists") is met.

`divUpE2` / `roundUpE2` themselves already live in
`fs/types/bigint/module.f.ts` (`:269` / `:280`), so the `3n` specialisation
belongs in the same module next to them, not re-pinned in each caller. Pinning
`8` (= `2^3`) is a generic bigint concern (bit count → byte count), with no
crypto- or ASN.1-specific meaning.

## Proposal

Export the two specialisations from `fs/types/bigint/module.f.ts`, immediately
after `divUpE2` / `roundUpE2`:

```ts
// bits -> bytes (divide by 8, rounding up)
export const divUp8: Unary = divUpE2(3n)
export const roundUp8: Unary = roundUpE2(3n)
```

Then in both consumers, drop the local definitions and import the shared ones:

```ts
// fs/crypto/sign/module.f.ts
import { bitLength, divUp8, roundUp8, type Unary } from '../../types/bigint/module.f.ts'
// (delete the two local `const divUp8`/`roundUp8` lines)
```

```ts
// fs/asn.1/module.f.ts
import { bitLength, divUp8 } from '../types/bigint/module.f.ts'
// (delete the local `const divUp8` line)
```

Add a one-line JSDoc on each new export documenting the "bits → bytes,
rounding up" intent (and that the `8` is `2^3` bits per byte), so the magic
exponent is explained once in the canonical place. Cover the new exports in
`fs/types/bigint/proof.f.ts` so the 100% proof requirement still holds.

This is a small, low-risk reuse: the runtime behaviour at every call site is
byte-identical; only the definition site moves.

## Tasks

- [ ] Add `divUp8` / `roundUp8` exports (with JSDoc) to
      `fs/types/bigint/module.f.ts`, next to `divUpE2` / `roundUpE2`.
- [ ] Import them in `fs/crypto/sign/module.f.ts` and delete the two local
      definitions.
- [ ] Import `divUp8` in `fs/asn.1/module.f.ts` and delete the local
      definition.
- [ ] Extend `fs/types/bigint/proof.f.ts` to exercise the new exports
      (full line/branch coverage).
- [ ] Run `npx tsc` and `fjs t`; confirm `sign`, `asn.1`, and `bigint` proofs
      still pass.

## Related

- [i113-bigint-bitlen-proposal](./113-bigint-bitlen-proposal.md) — adjacent
  bit-length work in the same `types/bigint` module (the ECMAScript
  `BigInt.bitLen()` proposal). `bitLength` is the input these `divUp8` calls
  consume; both belong to the same bit-arithmetic concern.
- AGENTS.md, *"When a sibling module already has the type or helper you need,
  import it … rather than duplicating it"* — the governing rule here.
