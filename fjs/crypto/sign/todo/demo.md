## `sign` demo

**Priority:** P3
**Status:** open

### Problem

[`fjs/crypto/sign`](../module.f.mjs) signs and verifies RFC 6979
deterministic ECDSA, but unlike its `hmac`, `sha2` and `pow` neighbours it has
no website demo.

### Proposal

A `demo.f.mjs` in the shape of `hmac`'s: choose a curve and a SHA-2 variant,
enter a private key in hex and a UTF-8 message, and see each RFC 6979 §2.4
value in turn — `h`, the deterministic nonce `k` from `computeK`, the public
key `xG`, and the signature `(r, s)` — with `verify`'s verdict on a signature
the reader can edit, and a matching OpenSSL command. Same key and message give
the same `k`; one changed character changes it completely, which is the point
of RFC 6979.

An optional section signs two messages with one fixed `k` and recovers the
private key from the two signatures, `x = (s1·h2 − s2·h1) / (r·(s2 − s1))`,
showing the failure deterministic nonces prevent.

### Tasks

- [ ] `demo.f.mjs` with its proof.
