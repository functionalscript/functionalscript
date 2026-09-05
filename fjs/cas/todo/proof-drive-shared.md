## proof-drive-shared. Two proof modules hand-roll the same synthetic CAS driver

**Priority:** P4
**Status:** open

### Problem

`fjs/cas/proof.f.mjs` and `fjs/mcp/cas/proof.f.mjs` each build a `drive`
helper that runs a `FileCasOperation` effect against queued synthetic
responses, and between them the same knowledge is restated five times:

- the 11-command table (`access … writeBytes`) appears three times —
  `casCommand` (`cas/proof.f.mjs:29-40`), `drive`'s `handlers`
  (`cas/proof.f.mjs:91-103`), and `mcp/cas/proof.f.mjs:74-89`'s `handlers`
  (which adds three `MemOp` rows);
- the default-response switch appears twice (`cas/proof.f.mjs:48-59`,
  `mcp/cas/proof.f.mjs:28-45` — the latter extends it with `readBytes` and
  the `MemOp` defaults);
- the hand-rolled interpreter loop appears twice
  (`const run_ = e => { const m = matcher(e); return m[0] === 'done' ? m[1] : run_(m[2](m[1])) }`),
  re-deriving the `Pure`/`Do` walk that `fjs/effects/mock`'s runner
  already owns.

Adding an operation to `FileCasOperation` means editing three tables in two
files, and only `casCommand`'s totality catches one of them.

### Proposal

One exported driver next to the CAS (exported from `cas/proof.f.mjs`, or a
small test-support module if proof-to-proof imports are unwanted):
`driveCas(overrides)` owning the command table, the default responses, and
the loop — ideally expressed over `fjs/effects/mock`'s runner rather than a
third hand-rolled walk — with an extension point for extra operations, so
`mcp/cas/proof.f.mjs` spreads in its `MemOp` handlers and its `readBytes`
default the way `commonOperationMap` is spread into the node runner. One
table, one switch, no duplicate loop; the queue-then-default semantics stay
exactly as both copies have them.

### Tasks

- [ ] Extract the shared driver with the `MemOp`/default extension point;
      port both proof modules.
- [ ] `tsc`, `fjs t`.

### Related

- [filecasoperation-duplicates.md](./filecasoperation-duplicates.md) —
  duplication in the operation type itself; this is the proof-side echo of
  the same vocabulary.
- [../../effects/memory/todo/sync-interpreter-owner.md](../../effects/memory/todo/sync-interpreter-owner.md)
  — names the `MemOperationMap` copies; adjacent, different helper.
