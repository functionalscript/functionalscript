## `sign` demo

**Priority:** P3
**Status:** wip

### Problem

[`fjs/crypto/sign`](../module.f.mjs) signs and verifies RFC 6979
deterministic ECDSA, but unlike its `hmac`, `sha2` and `vdf` neighbours it has
no website demo.

### Proposal

A `demo.f.mjs` in the shape of the `vdf` demo's two halves:

- **Sign:** choose a named curve and a SHA-2 variant, enter a private key in
  hex and a UTF-8 message, and see the public key `xG`, the deterministic
  nonce `k` from `computeK`, and the signature `(r, s)`. The same key and
  message always give the same `k`; one changed character changes it
  completely, which is the point of RFC 6979.
- **Verify:** `r` and `s` fields of their own, checked by `verify` against
  the public key and message above, so editing the message or a signature
  digit shows a rejection.

It opens on RFC 6979 A.2.5 — P-256, SHA-256, message `sample` — so a reader
can compare `k`, `r` and `s` with the RFC's published values.

### Tasks

- [ ] `demo.f.mjs` with its proof.
- [ ] An OpenSSL command that verifies the signature, as the hash demos have:
      it needs the public key as PEM and the signature as DER, which
      [`asn.1`](../../../asn.1/module.f.mjs) can encode.
- [ ] Optionally, a nonce-reuse section: two messages signed with one fixed
      `k`, and the private key recovered as
      `x = (s1·h2 − s2·h1) / (r·(s2 − s1))`.
