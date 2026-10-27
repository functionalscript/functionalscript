## Lower spread tail arguments

**Priority:** P2
**Status:** wip

### Problem

Terminal self-calls with spread arguments still consume host stack even when
the function has only fixed parameters and does not observe its rest array.

### Proposal

Extend the existing placed-evaluation tail pass using its required private
argument array. Expand spreads and evaluate ordinary arguments before any loop
state changes, then read the fixed prefix. Preserve missing values, unused extra
evaluations and failures, lazy demands, capture snapshots, function arity and
remaining non-tail recursion. Reuse common array-spread preparation. Observed
rest and lowered defaults that read it remain ordinary calls in this increment.

### Tasks

- [ ] Lower spread self-call arguments through the existing invocation array.
- [ ] Prove empty/multiple/string spreads, missing and extra values, failures,
      simultaneous updates, captures and stable graph/source normalization.
- [ ] Verify bounded-stack JavaScript/Rust execution and affected browser demos.

### Related

- [Tail-call loops](../../todo/tail-call-loop.md) — milestone F owner.
- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
  — epic and ordered integration gates.
