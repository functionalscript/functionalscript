## Lower fixed-parameter tail calls

**Priority:** P2
**Status:** wip

### Problem

Shared FAST conversion recognizes only the existing scalar recursion template.
Terminal self-calls in other conditional arms or final sequence operands still
use host recursion, including the more general helper shapes constructed in E.

### Tasks

- [ ] Recognize terminal self-call evaluations after shared-value placement,
      preserving established call-result reads and ordinary non-tail recursion.
- [ ] Construct canonical invocation loops for fixed parameters and matching,
      spread-free recursive arguments, preserving snapshots and captures.
- [ ] Cover conditional arms, sequence prefixes, argument swaps, per-invocation
      lifetimes, stable graph round trips and bounded-stack JavaScript/Rust output.

### Related

- [Tail-call loops](../../todo/tail-call-loop.md#general-tail-calls) owns F.
- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
  defines the integration order.
