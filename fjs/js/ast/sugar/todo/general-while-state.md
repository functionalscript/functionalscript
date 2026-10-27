## Lower general while state

**Priority:** P2
**Status:** wip

### Problem

Source `while` still requires one assigned outer variable, despite the completed
general FAST loop construction and tail-call output. Source state selection
must use the shared binding facts rather than the parser's scalar assignment
template.

### Proposal

Implement the first milestone H increment for plain while bodies. Select outer
mutable bindings read or written by a loop in binding-introduction order, keep
loop-local declarations local, and normalize through the existing explicit
state/result signatures. Admit zero or multiple state values and module or
sequential placements supported by this body grammar. Preserve required work,
condition re-evaluation, captures and the existing scalar exact-graph domain.
Check admitted source output and stable round trips through the shared path.
Structured loop bodies, nested loops and explicit exits remain later H steps.

### Tasks

- [ ] Replace scalar source-loop admission/state selection with shared facts.
- [ ] Lower simultaneous loop inputs/results and preserve lexical scopes.
- [ ] Prove source round trips, failures, zero/wide state and bounded-stack
      JavaScript/Rust execution.
- [ ] Update the admitted-source specification and affected demos.

### Related

- [Let proposal](../../../../../spec/todo/3220-let.md#general-loops) — source owner
  and recorded language-design approval.
- [General loops and tail calls](../../../../todo/general-loops-and-tail-calls.md)
  — milestone H and its completed prerequisites.
