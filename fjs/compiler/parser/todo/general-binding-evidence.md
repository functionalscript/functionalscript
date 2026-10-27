## Complete general-binding evidence

**Priority:** P2
**Status:** wip

### Problem

General bindings are implemented, but milestone G and its compatibility/proof
checklist remain open. Existing proofs cover the principal admission rules;
composed destructured-parameter, mutability/shadowing and unreachable-write
capture cases need explicit evidence before the checklist closes.

### Proposal

Audit the existing shared analysis and source admission proofs. Add focused
composition cases rather than repeat the whole variable suite. Reconcile the
current write-based capture rule, snapshots and retained immediate-call reads
with the approved language proposal and compatibility documentation. Keep the
current single-variable loop grammar; general loops remain milestone H.

### Tasks

- [ ] Pin destructured-parameter write/capture admission and shadowed identities.
- [ ] Pin capture refusal before unreachable writes are optimized away.
- [ ] Reconcile the G compatibility/proof checklist and epic completion gate.
- [ ] Run the affected proofs and verify documented examples.

### Related

- [Let proposal](../../../../spec/todo/3220-let.md#general-bindings) — source owner.
- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
  — epic and G/H boundaries.
