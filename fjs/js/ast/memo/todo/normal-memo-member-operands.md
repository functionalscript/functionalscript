## Share normal lazy demands through member and optional calls

**Priority:** P2
**Status:** wip

### Problem

Normal-only memo plans still refuse lazy demands through optional property
access and member/optional-call operands. Completion-bearing plans already
sequence these regions. Shared lazy values need the same optional skips,
lookup order and receiver semantics without an owning return.

### Tasks

- [ ] Reuse shared operand sequencing for normal-only member and optional calls.
- [ ] Preserve skipped demands, lookup order, receiver and cell lifetimes.
- [ ] Cover sharing, graph round trips and JavaScript/Rust execution.

### Related

- [FAST loop construction](../../../../edag/todo/fast-loop-construction.md)
  owns the remaining memo and operand boundaries.
