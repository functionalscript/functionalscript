## `sign` demo: an OpenSSL check and nonce reuse

**Priority:** P4
**Status:** open

### Problem

The [`sign` demo](../demo.f.mjs) signs and verifies on a named curve, and
opens on RFC 6979 A.2.5 so a reader can check its values against the RFC.
Two things it could show are missing:

- **An independent check.** The hash demos end with an OpenSSL command that
  reproduces their result; this one has none, so a signature typed into the
  page can only be checked by the page itself.
- **Why the nonce matters.** RFC 6979 exists because a repeated or
  predictable `k` gives the private key away, and the demo only shows the
  safe case.

### Proposal

- An OpenSSL command under Verify that checks the signature: the public key
  as a PEM SubjectPublicKeyInfo and the signature as a DER SEQUENCE of two
  INTEGERs, both of which [`asn.1`](../../../asn.1/module.f.mjs) can encode,
  quoted literally as the hash demos' `opensslVerification` quotes its
  arguments.
- A section that signs two messages with one fixed `k`, and recovers the
  private key from the two signatures as
  `x = (s1·h2 − s2·h1) / (r·(s2 − s1)) mod q`.

### Tasks

- [ ] The OpenSSL command.
- [ ] The nonce-reuse section.
