## Emit general plain loops as source while statements

**Priority:** P2
**Status:** wip

### Problem

General source loops now accept zero or multiple state values, but source
`.js`/`.mjs` serialization reifies their aggregate helpers as recursion. A
100,000-round counter/sum loop overflows on V8 despite bounded-stack code-only
JavaScript and Rust output. The concrete case is recorded in the
[output owner](../../../../edag/todo/tail-call-loop.md#remaining-general-source-output).

### Proposal

Connect the admitted plain-loop grammar to common loop recognition and
preparation. Emit eligible aggregate helpers as ordinary `while` statements,
preserving iteration entry projections, normal-result computation, evaluation
and capture lifetimes. Keep established scalar graphs and source spelling;
source round trips must stabilize without helper growth. Structured loop bodies,
module placement and explicit loop exits remain separate H increments.

### Tasks

- [ ] Recognize and prepare the general plain-loop shape in shared FAST owners.
- [ ] Connect source serialization without target-specific state analysis.
- [ ] Prove deep source execution, required failures, identity/capture lifetimes
      and stable graph/source conversions alongside existing scalar behavior.
- [ ] Update the public output contract and verify affected browser demos.

### Related

- [Source loop owner](../../../../../../spec/todo/3220-let.md#general-loops)
- [General loops and tail calls](../../../../../todo/general-loops-and-tail-calls.md)
