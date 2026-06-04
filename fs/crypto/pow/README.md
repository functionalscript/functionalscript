# Proof-of-work (`pow`)

Bitcoin-style proof-of-work helpers under `fs/crypto/pow/`.

## nBits compact target

Block header **nBits** (32-bit) encodes the **target**:

- `exponent = nBits >> 24`
- `mantissa = nBits & 0xffffff`
- `target = mantissa × 2^(8 × (exponent − 3))`

Valid PoW: SHA-256 hash of the pre-image, interpreted as big-endian uint256, is
`≤ target`.

`targetFromNBits` rejects malformed compact encodings (negative sign bit,
overflow, target wider than 256 bits) using the same rules as Bitcoin
`SetCompact`.

## API

- `targetFromNBits(nBits)` — decode compact target.
- `pow(sha256)` — `{ hashInt, meets }` for an injected `Sha2`.
- `sha256Pow` / `bitcoinPow` — pre-built SHA-256 PoW (Bitcoin block headers).

Mining/search loops stay outside the module; callers iterate nonces and call
`meets`.

## Why not leading-zero bits?

Leading-zero-bit PoW is a teaching simplification. This module follows the
production Bitcoin interface (compact **nBits** + integer comparison) so targets
match block headers and existing tooling.
