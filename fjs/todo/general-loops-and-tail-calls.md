## General loops and tail calls

**Priority:** P2
**Status:** wip — writing the epic; implementation has not started

### Problem

The current compiler recognizes a narrow loop template. Track general local
rebinding, FAST normalization and tail self-call lowering in one dependency
plan, reusing the existing compiler architecture and loop migration work.

### Tasks

- [ ] Complete the epic's steps, dependencies and semantic examples.

### Related

- [Compiler vocabulary and modularization](./compiler-vocabulary-and-modularization.md).
- [Tail-call loops](../edag/todo/tail-call-loop.md).
- [Let statement](../../spec/todo/3220-let.md).
