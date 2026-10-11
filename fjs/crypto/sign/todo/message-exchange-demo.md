## `sign` demo: Alice → Eve → Bob message exchange

**Priority:** P4
**Status:** wip

### Problem

The [current demo](../demo.f.mjs) signs and verifies live against one
public key. It does not show how interception changes a delivered message,
or why a signature valid under a substituted key does not authenticate Alice.

This task records the supplied `crypto_sign_demo_codex_spec.docx`
(11 October 2026). It redesigns the website demo, preserving genuine ECDSA,
the existing curve and SHA-2 choices, copyable hexadecimal outputs, and the
independently checkable RFC 6979 A.2.5 P-256/SHA-256 `sample` example.

### Proposal

Show three ordered sections with a compact Alice → Eve → Bob flow.

- **Alice — Sign:** edit curve, hash, hexadecimal private key and multiline
  UTF-8 message. Derive public coordinates and signature while typing;
  show the deterministic nonce only in collapsible signing details.
  Label keys demo-only and warn against entering real private keys.
  **Send message** snapshots message, signature, public key and algorithm
  parameters into Eve's workspace. Never transmit the private key or nonce.
- **Eve — Intercept & Attack:** wait for Alice's packet and disable forwarding
  before it arrives. Offer exactly three attacks: **Modify message**, retaining
  Alice's signature; **Modify signature**, retaining the message; and
  **Replace public key**, signing an Eve-controlled message with an independent
  demo-only key on the intercepted curve/hash while claiming to be Alice.
  Include obvious message and invalid-signature examples, such as `r = 0`.
  Switching attacks and **Reset Eve** start from the original intercepted
  snapshot. **Forward to Bob** snapshots Eve's outgoing public packet.
- **Bob — Receive & Verify:** wait without a fabricated verdict until delivery.
  Display read-only received message, signature, public key, curve/hash and
  Alice's trusted public coordinates. Verify on delivery against Alice's
  trusted key. For key replacement, also verify against the received key,
  distinguishing mathematical validity from authentication as Alice.
  Bob has no editable verification fields or Verify button.

Keep Alice's draft, Eve's intercepted packet and edits, and Bob's last delivery
separate. Changes after Send or Forward must not mutate previous snapshots.
A new Send replaces Eve's packet and resets its edits; Bob keeps a clearly
labeled last received packet until another Forward. Preserve Alice's trusted
public key with the exchange independently of Eve's substituted key.

Reuse `sign`, `verify`, `computeK` and existing website helpers. Only actual
verification decides validity, including arbitrary syntactically valid scalar
edits. Refuse malformed hexadecimal, out-of-range private keys, invalid
signature scalars and oversized UTF-8 messages clearly, without crashes.
Use a reproducible local demo key for Eve; do not claim secure random generation.

Replay, nonce reuse/private-key recovery, OpenSSL/PEM/DER verification,
network transport, certificates/PKI and secure key-generation UI are out of
scope. The separate [existing demo TODO](./demo.md) retains its scope.

### Tasks

- [ ] Define separate draft, intercepted and delivered state and public packet
  types; implement Send, Forward, Reset and attack-selection transitions.
- [ ] Build Alice's signing section with the RFC default, copyable outputs,
  collapsible details, demo-key warning and clear signing refusals.
- [ ] Implement all three Eve attacks with independent signing for key
  replacement, deterministic examples and forwarding refusal before Send.
- [ ] Build Bob's read-only delivery and real verification results under the
  trusted Alice key and, for key replacement, the received key.
- [ ] Prove the RFC default and unchanged forwarding valid; message tampering
  and known invalid signature edits rejected; Eve's replacement valid under
  Eve's key and invalid under Alice's trusted key.
- [ ] Prove snapshot isolation after both actions, attack-switch resets,
  Reset Eve, new-Send behavior, waiting states and input refusals.
- [ ] Run repository checks; verify the website demo in a browser and record
  the preview URL and results in the implementation PR.

### Related

- [Signature implementation](../module.f.mjs) — reuse actual ECDSA operations.
- [Website demos](../../../website/README.md) — existing demo conventions.
- [OpenSSL and nonce-reuse TODO](./demo.md) — separate future lessons.
