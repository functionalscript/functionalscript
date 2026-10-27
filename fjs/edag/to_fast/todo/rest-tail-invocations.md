## Lower tail invocations with rest

**Priority:** P2
**Status:** wip

### Problem

Tail self-calls still consume host stack when the function reads its rest
parameter, including defaults lowered through rest. Fixed invocation roots
cannot yet reconstruct their complete invocation state.

### Proposal

Extend canonical invocation reconstruction and common tail lowering together.
Each represented invocation must have a fresh rest array, with sharing within
the invocation and escaped capture snapshots preserved. Establish arguments
and spreads before simultaneous state updates, and rerun lowered parameter
setup per iteration. Preserve public arity, including sixteen fixed parameters
plus rest, and ordinary non-tail self uses. Reconstruct only invocation layouts
whose rest identity and argument recipe are preserved by an ordinary call.

### Tasks

- [ ] Extend the canonical root contract and reconstruction for rest invocations.
- [ ] Lower eligible observed-rest tail evaluations through the common path.
- [ ] Prove fresh/shared rest identity, captures, defaults/destructuring, failures,
      arity, stable graph/source round trips and deep JavaScript/Rust execution.
- [ ] Verify affected browser demos and reconcile the milestone F record.

### Related

- [Tail-call loops](../../todo/tail-call-loop.md) — milestone F owner.
- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
  — epic and ordered integration gates.
