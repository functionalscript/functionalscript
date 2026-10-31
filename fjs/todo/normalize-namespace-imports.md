## Normalize namespace imports

**Priority:** P3
**Status:** wip

### Problem

Repository sources use namespace imports that the current FJS syntax parser
cannot represent. Explicit named imports can express the bindings these
sources need while namespace syntax support remains planned in
[`2220-namespace-import`](../../spec/todo/2220-namespace-import.md).

### Tasks

- [ ] Inventory namespace imports and their actual consumers.
- [ ] Replace executable namespace imports with named imports, preserving
      host behavior and specification proof assertions.
- [ ] Separate AST support from compiler admission in the namespace TODO.
- [ ] Run the checks required by the changed source and proofs.
