## `sign` demo: an OpenSSL check and nonce reuse

**Priority:** P4
**Status:** wip

### Problem

The [`sign` demo](../demo.f.mjs) updates Alice’s signing output as her draft
changes. **Send message** snapshots a signed public packet for Eve;
**Forward to Bob** snapshots Eve’s outgoing packet and verifies it with
Alice’s saved trusted public key. It opens on RFC 6979 A.2.5 so a reader can
check its signing values against the RFC. Two things it could show are missing:

- **An independent check.** The hash demos end with an OpenSSL command that
  reproduces their result; this one has none, so Bob’s received signature
  can only be checked by the page itself.
- **Why the nonce matters.** RFC 6979 exists because a repeated or
  predictable `k` gives the private key away, and the demo only shows the
  safe case.

### Proposal

- An OpenSSL command in **Bob — Receive & Verify** that reproduces Bob’s
  trusted-key verdict for his last received snapshot: the forwarded message,
  signature, curve and hash, together with Alice’s saved trusted public key.
  Emit that key as a PEM SubjectPublicKeyInfo and the signature as a DER
  SEQUENCE of two INTEGERs, both of which
  [`asn.1`](../../../asn.1/module.f.mjs) can encode, quoted literally as the
  hash demos' `opensslVerification` quotes its arguments. The command appears
  after Forward and follows Bob’s snapshot, not subsequent Alice or Eve edits.
  A substituted key must not silently replace the trusted key in this check.
- A section that signs two messages with one fixed `k`, and recovers the
  private key from the two signatures as
  `x = (s1·h2 − s2·h1) / (r·(s2 − s1)) mod q`.

### Tasks

- [ ] The OpenSSL command.
- [ ] The nonce-reuse section.
