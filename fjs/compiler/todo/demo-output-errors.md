# Keep compiler demo failures inside their output pane

**Priority:** P1
**Status:** wip

## Problem

On https://functionalscript.com/fjs/compiler/, choosing Recursion: Ackermann
and changing `ack(2, 3)` to `ack(2, 333)` overflows the interpreter's host
stack while producing JSON. The thrown exception aborts the whole demo,
including the source outputs that need no evaluation.

## Proposal

Compile each output through the existing `catch` effect during update and
retain its result in demo state. Render failures inside the affected pane;
keep the other outputs and source controls available. The owner selected
this scope; making the interpreter stack independent remains separate work
in `bound-edag-interpreter-resources.md` and `../../edag/todo/stack-safety.md`.

## Tasks

- [ ] Move output compilation from view to update and catch failures per pane.
- [ ] Prove successful outputs, refused outputs, host failures, and recovery.
- [ ] Run type checking, scoped compiler proofs and coverage, and compilation.
