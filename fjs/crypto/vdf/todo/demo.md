## Website demo

**Priority:** P3
**Status:** wip

### Problem

`fjs/crypto/vdf` has no website demo. A verifiable delay function has one
property worth seeing: evaluation is slow and sequential while verification is
fast, and a reader understands that by watching it rather than by reading it.

### Proposal

A `demo.f.mjs` next to the module:

- **Input:** a text field. Its UTF-8 bytes are hashed with SHA-256 and the
  digest, read as a big-endian integer, is `x`. The digest is shown in hex so a
  reader can check it outside this repository.
- **Steps:** a decimal field for the delay.
- **Evaluate:** a button that runs `sloth.eval` incrementally through
  `nextEvent`, a small batch of steps per turn, showing progress and a
  **Stop** button, so the page stays responsive. Batching is exact because
  `eval(a + b)(x) = eval(b)(eval(a)(x))`.
- **Result:** `y` in hex, and a ✓/✗ line from one `sloth.verify` call.
- **Tamper check:** `y` is an editable field; changing a digit makes the
  verification fail at once.

Timing is out of scope for now: demos have no clock operation.

### Tasks

- [x] `demo.f.mjs` with evaluate, progress, stop and verify
- [x] `proof.f.mjs` coverage for the demo
- [x] browser check of the demo page

### Related

- [mental-poker.md](../../todo/mental-poker.md) — uses a VDF to open cards of
  a dropped player.
