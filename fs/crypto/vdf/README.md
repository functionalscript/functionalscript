# Verifiable delay function (`vdf`)

Sloth VDF over a fixed 3072-bit safe prime (`p`), adapted from
[hyperhyperspace/pulsar](https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts)
and [dignity.js `sloth-vdf.js`](https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js).

## Operations

| Function | Cost | Role |
|----------|------|------|
| `eval(steps)(x)` | O(steps) sequential `modSqrt` | Slow evaluation (the delay) |
| `verify(steps)(x)(y)` | O(steps) modular squaring | Fast verification |

All values are `bigint` mod `p`. Invalid `steps < 0` yields `null` from `eval` and
`false` from `verify` (no `throw`).

## API

- `p` — Sloth modulus.
- `sloth_vdf(modulus)` — builds `{ quadRes, modSqrt, eval, verify }` over a prime.
- `sloth` — `sloth_vdf(p)`.
- Uses `prime_field` (`reduce`, `quadRes` on the field; `modSqrt`, `pow2`, `neg` for Sloth).

Hex string wrappers belong in caller code, not this module.

## Test vectors

Proofs in `proof.f.ts` pin `sloth.eval(steps)(x)` for several `(x, steps)` pairs on
{@link p}. Values match the reference Sloth implementations linked above (pulsar and
dignity.js use the same modulus and algorithm).
