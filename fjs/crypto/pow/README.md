# Proof-of-work (`pow`)

Bitcoin-style proof-of-work helpers under `fjs/crypto/pow/`.

## nBits compact target

Block header **nBits** (32-bit) encodes the **target**:

- `exponent = nBits >> 24`
- `mantissa = nBits & 0xffffff`
- `target = mantissa × 2^(8 × (exponent − 3))`

Valid PoW: SHA-256 hash of the pre-image, interpreted as big-endian uint256, is
`≤ target`.

`targetFromNBits` returns `null` for malformed compact encodings (negative sign
bit, overflow, target wider than 256 bits) using the same rules as Bitcoin
`SetCompact`. Invalid **nBits** makes `meets` return `false`.

## API

- `targetFromNBits(nBits)` — decode compact target.
- `pow(sha256)` — `{ hashInt, meets }` for an injected `Sha2`.
- `sha256Pow` / `bitcoinPow` — pre-built SHA-256 PoW (Bitcoin block headers).

Mining/search loops stay outside the module; callers iterate nonces and call
`meets`.

## Interactive demo

The website demo hashes UTF-8 input followed by a non-negative nonce in decimal.
`Try next nonce` increments it once, retaining the input and nBits. The page
shows the exact hashed input, the decoded target, the SHA-256 digest in hex,
and whether `hash ≤ target`. Each output uses the shared copyable
code-block controls.

`Auto-run nonce` starts with the current nonce, or the next nonce if the
current one already meets the target. It advances one nonce per browser turn
until it finds a valid proof, so repeated clicks find successive valid nonces. The button becomes `Stop`, and
editing any input also stops the search. The page reports the attempt count
and failed nonce range, retaining the summary when stopped or successful.

It starts with `Hello, FunctionalScript!`, nonce `42`, and the easy target
`0x200fffff`; nonce `53` meets that target. Enter `0x1d00ffff` to inspect the
Bitcoin genesis target. The collapsed `Expected search effort` section below
nBits compares average attempts for four targets; a search may finish sooner
or take longer. Invalid nBits and nonce fields show a message instead
of a stale result. Nonces use bigint, so stepping does not lose integer precision.

This demonstrates this module's single SHA-256 hash and big-endian comparison.
Bitcoin hashes a binary block header twice and interprets the hash with a
different byte order; the demo is not a Bitcoin block miner.

## Why not leading-zero bits?

Leading-zero-bit PoW is a teaching simplification. This module follows the
production Bitcoin interface (compact **nBits** + integer comparison) so targets
match block headers and existing tooling.
