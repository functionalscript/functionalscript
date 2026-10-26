## Share normal lazy demands through standalone spreads

**Priority:** P2
**Status:** wip

### Problem

Normal-only memo plans still refuse standalone array, plain-call and object
spread operands that demand a selected lazy cell. The shared operand sequencer
already handles these regions for completion-bearing plans.

### Tasks

- [ ] Reuse operand sequencing with the normal value/state pair protocol.
- [ ] Preserve reached expansion order, skipped work and shared cell lifetimes.
- [ ] Sequence object keys before values, with or without spreads.
- [ ] Cover stable graph round trips and JavaScript/Rust execution.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  owns the remaining operand and memo boundaries.
