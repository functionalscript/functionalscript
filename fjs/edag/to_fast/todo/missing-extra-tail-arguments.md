## Lower missing and extra tail arguments

**Priority:** P2
**Status:** wip

### Problem

The fixed-parameter tail pass requires the recursive argument count to match the
function's fixed signature. Spread-free calls with missing or extra arguments
therefore still consume host stack even when their evaluation is terminal.

### Proposal

Extend the existing placed-evaluation pass for functions without observed rest.
Missing parameters receive `undefined`. Establish supplied arguments before
changing loop state, including unused extra arguments and their failures.
Preserve simultaneous updates, captures, per-iteration lifetimes, function arity
and remaining non-tail self calls. Spread calls and observed rest stay ordinary
calls in this increment.

### Tasks

- [ ] Normalize spread-free tail arguments to the existing fixed loop signature.
- [ ] Prove missing values, required extra evaluations, simultaneous updates,
      captures, retained boundaries and stable repeated graph conversions.
- [ ] Verify bounded-stack JavaScript/Rust execution and affected browser demos.

### Related

- [Tail-call loops](../../todo/tail-call-loop.md) — milestone F owner.
- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
  — epic and ordered integration gates.
